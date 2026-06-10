;(function () {
  "use strict"

  var CANONICAL_BASE =
    "https://talorlik.github.io/claude-code-ai-coach-assistant"
  var THEME_STORAGE_KEY = "studio-itai-docs-theme"
  var THEME_META = {
    dark: "#1c1917",
    light: "#e8ebed",
  }
  var FAVICONS = {
    dark: "./design/favicon_dark.ico",
    light: "./design/favicon_light.ico",
  }

  function getMetaDescription() {
    var el = document.querySelector('meta[name="description"]')
    if (el && el.getAttribute("content")) {
      return el.getAttribute("content").trim()
    }
    return ""
  }

  function getTheme() {
    return document.documentElement.getAttribute("data-theme") || "dark"
  }

  function updateFavicon(theme) {
    var favicon = document.querySelector("#favicon")
    if (!favicon) {
      return
    }
    favicon.setAttribute("href", FAVICONS[theme] || FAVICONS.dark)
  }

  function updateThemeMeta(theme) {
    var meta = document.querySelector('meta[name="theme-color"]')
    if (!meta) {
      return
    }
    meta.setAttribute("content", THEME_META[theme] || THEME_META.dark)
  }

  function setTheme(theme) {
    var nextTheme = theme === "light" ? "light" : "dark"
    document.documentElement.classList.remove("dark", "light")
    document.documentElement.classList.add(nextTheme)
    document.documentElement.setAttribute("data-theme", nextTheme)
    updateThemeMeta(nextTheme)
    updateFavicon(nextTheme)
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme)
    } catch {
      // Theme persistence is optional. Private browsing may block localStorage.
    }
    updateThemeToggle(nextTheme)
  }

  function updateThemeToggle(theme) {
    var toggle = document.querySelector("[data-theme-toggle]")
    var label = document.querySelector("[data-theme-label]")
    if (!toggle || !label) {
      return
    }
    var nextThemeLabel = theme === "light" ? "dark" : "light"
    toggle.setAttribute("aria-label", "Switch to " + nextThemeLabel + " theme")
    label.textContent = theme === "light" ? "Light" : "Dark"
  }

  function initThemeToggle() {
    var toggle = document.querySelector("[data-theme-toggle]")
    if (!toggle) {
      return
    }
    setTheme(getTheme())
    toggle.addEventListener("click", function () {
      setTheme(getTheme() === "light" ? "dark" : "light")
    })
  }

  function injectJsonLd() {
    var description = getMetaDescription()
    var payload = {
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "WebSite",
          "@id": CANONICAL_BASE + "/#website",
          name: "Studio Itai AI Coach Assistant",
          url: CANONICAL_BASE + "/",
          description: description,
          inLanguage: "en",
        },
        {
          "@type": "SoftwareSourceCode",
          "@id": CANONICAL_BASE + "/#source-code",
          name: "Studio Itai AI Coach Assistant",
          codeRepository:
            "https://github.com/talorlik/claude-code-ai-coach-assistant",
          programmingLanguage: ["TypeScript", "JavaScript", "SQL"],
          runtimePlatform: "Next.js, React, Supabase, Vercel",
          description: description,
          url: CANONICAL_BASE + "/",
          author: {
            "@type": "Person",
            name: "Tal Orlik",
            url: "https://github.com/talorlik",
          },
        },
        {
          "@type": "WebPage",
          "@id": CANONICAL_BASE + "/#webpage",
          url: CANONICAL_BASE + "/",
          name: "Studio Itai AI Coach Assistant | AI Fitness Coaching Platform",
          description: description,
          inLanguage: "en",
          image: CANONICAL_BASE + "/design/header_banner.png",
          isPartOf: { "@id": CANONICAL_BASE + "/#website" },
          mainEntity: { "@id": CANONICAL_BASE + "/#source-code" },
        },
      ],
    }

    var el = document.createElement("script")
    el.type = "application/ld+json"
    el.textContent = JSON.stringify(payload)
    document.head.appendChild(el)
  }

  function initCurrentSection() {
    var links = Array.prototype.slice.call(
      document.querySelectorAll('.nav-links a[href^="#"]')
    )
    var sections = links
      .map(function (link) {
        return document.querySelector(link.getAttribute("href"))
      })
      .filter(Boolean)

    if (!("IntersectionObserver" in window) || sections.length === 0) {
      return
    }

    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) {
            return
          }
          links.forEach(function (link) {
            var isCurrent = link.getAttribute("href") === "#" + entry.target.id
            if (isCurrent) {
              link.setAttribute("aria-current", "true")
            } else {
              link.removeAttribute("aria-current")
            }
          })
        })
      },
      { rootMargin: "-35% 0px -55% 0px", threshold: 0.01 }
    )

    sections.forEach(function (section) {
      observer.observe(section)
    })
  }

  function initReveal() {
    var items = Array.prototype.slice.call(
      document.querySelectorAll("[data-reveal-group] .timeline-item")
    )

    if (!("IntersectionObserver" in window) || items.length === 0) {
      items.forEach(function (item) {
        item.classList.add("is-visible")
      })
      return
    }

    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) {
            return
          }
          entry.target.classList.add("is-visible")
          observer.unobserve(entry.target)
        })
      },
      { threshold: 0.2 }
    )

    items.forEach(function (item, index) {
      item.style.transitionDelay = index * 80 + "ms"
      observer.observe(item)
    })
  }

  document.addEventListener("DOMContentLoaded", function () {
    document.documentElement.classList.add("js")
    initThemeToggle()
    injectJsonLd()
    initCurrentSection()
    initReveal()
  })
})()
