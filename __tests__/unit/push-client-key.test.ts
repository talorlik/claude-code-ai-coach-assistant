import { describe, expect, it } from "vitest"

import { urlBase64ToUint8Array } from "@/lib/push/client"

/**
 * Unit test for the VAPID key decoder. The Push API's `applicationServerKey`
 * wants the raw key bytes, but VAPID keys are distributed base64url-encoded.
 * This pins the base64url-to-bytes conversion (padding restoration and the
 * `-`/`_` -> `+`/`/` alphabet swap) that gates the subscribe flow. Runs in the
 * jsdom environment, which provides `atob`.
 */
describe("urlBase64ToUint8Array", () => {
  it("decodes a base64url string to the expected bytes", () => {
    // "hello" -> standard base64 "aGVsbG8=".
    const bytes = urlBase64ToUint8Array("aGVsbG8")
    expect(Array.from(bytes)).toEqual([104, 101, 108, 108, 111])
  })

  it("restores missing base64 padding before decoding", () => {
    // "any carnal pleasure." encodes to a length needing one '=' of padding.
    const padded = urlBase64ToUint8Array("YW55IGNhcm5hbCBwbGVhc3VyZS4=")
    const unpadded = urlBase64ToUint8Array("YW55IGNhcm5hbCBwbGVhc3VyZS4")
    expect(Array.from(unpadded)).toEqual(Array.from(padded))
  })

  it("maps the url-safe alphabet (- and _) to + and /", () => {
    // Bytes 0xFB 0xFF 0xFE -> standard base64 "+//+", url-safe "-__-".
    const urlSafe = urlBase64ToUint8Array("-__-")
    const standardEquivalent = urlBase64ToUint8Array("+//+")
    expect(Array.from(urlSafe)).toEqual(Array.from(standardEquivalent))
    expect(Array.from(urlSafe)).toEqual([251, 255, 254])
  })

  it("returns a Uint8Array backed by an ArrayBuffer", () => {
    const bytes = urlBase64ToUint8Array("aGVsbG8")
    expect(bytes).toBeInstanceOf(Uint8Array)
    expect(bytes.buffer).toBeInstanceOf(ArrayBuffer)
    expect(bytes.byteLength).toBe(5)
  })
})
