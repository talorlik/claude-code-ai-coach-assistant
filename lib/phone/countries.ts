/**
 * Static phone-country dataset and helpers for the country-code selector.
 *
 * The data is bundled (not fetched) so the selector renders instantly and works
 * offline. Each entry carries the ISO 3166-1 alpha-2 code, the ITU dialing code,
 * and both English and Hebrew display names for the localized UI.
 */

/**
 * A single country/territory row for the phone selector.
 *
 * - `iso2`: ISO 3166-1 alpha-2 code, uppercase (for example, "IL").
 * - `dialCode`: ITU calling code with a leading "+" (for example, "+972").
 * - `nameEn`: English display name.
 * - `nameHe`: Hebrew display name.
 */
export interface Country {
  readonly iso2: string
  readonly dialCode: string
  readonly nameEn: string
  readonly nameHe: string
}

/**
 * Complete ISO 3166-1 country/territory list, sorted by English name.
 *
 * Dial codes are the ITU-T E.164 country calling codes. Some codes are shared
 * (for example, "+1" across the North American Numbering Plan, "+7" for Russia
 * and Kazakhstan); the alpha-2 code disambiguates the row.
 */
export const COUNTRIES: readonly Country[] = [
  { iso2: "AF", dialCode: "+93", nameEn: "Afghanistan", nameHe: "אפגניסטן" },
  { iso2: "AX", dialCode: "+358", nameEn: "Åland Islands", nameHe: "איי אולנד" },
  { iso2: "AL", dialCode: "+355", nameEn: "Albania", nameHe: "אלבניה" },
  { iso2: "DZ", dialCode: "+213", nameEn: "Algeria", nameHe: "אלג'יריה" },
  { iso2: "AS", dialCode: "+1", nameEn: "American Samoa", nameHe: "סמואה האמריקנית" },
  { iso2: "AD", dialCode: "+376", nameEn: "Andorra", nameHe: "אנדורה" },
  { iso2: "AO", dialCode: "+244", nameEn: "Angola", nameHe: "אנגולה" },
  { iso2: "AI", dialCode: "+1", nameEn: "Anguilla", nameHe: "אנגווילה" },
  { iso2: "AQ", dialCode: "+672", nameEn: "Antarctica", nameHe: "אנטארקטיקה" },
  { iso2: "AG", dialCode: "+1", nameEn: "Antigua and Barbuda", nameHe: "אנטיגואה וברבודה" },
  { iso2: "AR", dialCode: "+54", nameEn: "Argentina", nameHe: "ארגנטינה" },
  { iso2: "AM", dialCode: "+374", nameEn: "Armenia", nameHe: "ארמניה" },
  { iso2: "AW", dialCode: "+297", nameEn: "Aruba", nameHe: "ארובה" },
  { iso2: "AU", dialCode: "+61", nameEn: "Australia", nameHe: "אוסטרליה" },
  { iso2: "AT", dialCode: "+43", nameEn: "Austria", nameHe: "אוסטריה" },
  { iso2: "AZ", dialCode: "+994", nameEn: "Azerbaijan", nameHe: "אזרבייג'ן" },
  { iso2: "BS", dialCode: "+1", nameEn: "Bahamas", nameHe: "איי בהאמה" },
  { iso2: "BH", dialCode: "+973", nameEn: "Bahrain", nameHe: "בחריין" },
  { iso2: "BD", dialCode: "+880", nameEn: "Bangladesh", nameHe: "בנגלדש" },
  { iso2: "BB", dialCode: "+1", nameEn: "Barbados", nameHe: "ברבדוס" },
  { iso2: "BY", dialCode: "+375", nameEn: "Belarus", nameHe: "בלארוס" },
  { iso2: "BE", dialCode: "+32", nameEn: "Belgium", nameHe: "בלגיה" },
  { iso2: "BZ", dialCode: "+501", nameEn: "Belize", nameHe: "בליז" },
  { iso2: "BJ", dialCode: "+229", nameEn: "Benin", nameHe: "בנין" },
  { iso2: "BM", dialCode: "+1", nameEn: "Bermuda", nameHe: "ברמודה" },
  { iso2: "BT", dialCode: "+975", nameEn: "Bhutan", nameHe: "בהוטן" },
  { iso2: "BO", dialCode: "+591", nameEn: "Bolivia", nameHe: "בוליביה" },
  { iso2: "BQ", dialCode: "+599", nameEn: "Bonaire, Sint Eustatius and Saba", nameHe: "בונייר, סנט אוסטטיוס וסבה" },
  { iso2: "BA", dialCode: "+387", nameEn: "Bosnia and Herzegovina", nameHe: "בוסניה והרצגובינה" },
  { iso2: "BW", dialCode: "+267", nameEn: "Botswana", nameHe: "בוטסואנה" },
  { iso2: "BV", dialCode: "+47", nameEn: "Bouvet Island", nameHe: "אי בובה" },
  { iso2: "BR", dialCode: "+55", nameEn: "Brazil", nameHe: "ברזיל" },
  { iso2: "IO", dialCode: "+246", nameEn: "British Indian Ocean Territory", nameHe: "הטריטוריה הבריטית באוקיינוס ההודי" },
  { iso2: "BN", dialCode: "+673", nameEn: "Brunei Darussalam", nameHe: "ברוניי" },
  { iso2: "BG", dialCode: "+359", nameEn: "Bulgaria", nameHe: "בולגריה" },
  { iso2: "BF", dialCode: "+226", nameEn: "Burkina Faso", nameHe: "בורקינה פאסו" },
  { iso2: "BI", dialCode: "+257", nameEn: "Burundi", nameHe: "בורונדי" },
  { iso2: "CV", dialCode: "+238", nameEn: "Cabo Verde", nameHe: "קייפ ורדה" },
  { iso2: "KH", dialCode: "+855", nameEn: "Cambodia", nameHe: "קמבודיה" },
  { iso2: "CM", dialCode: "+237", nameEn: "Cameroon", nameHe: "קמרון" },
  { iso2: "CA", dialCode: "+1", nameEn: "Canada", nameHe: "קנדה" },
  { iso2: "KY", dialCode: "+1", nameEn: "Cayman Islands", nameHe: "איי קיימן" },
  { iso2: "CF", dialCode: "+236", nameEn: "Central African Republic", nameHe: "הרפובליקה המרכז-אפריקנית" },
  { iso2: "TD", dialCode: "+235", nameEn: "Chad", nameHe: "צ'אד" },
  { iso2: "CL", dialCode: "+56", nameEn: "Chile", nameHe: "צ'ילה" },
  { iso2: "CN", dialCode: "+86", nameEn: "China", nameHe: "סין" },
  { iso2: "CX", dialCode: "+61", nameEn: "Christmas Island", nameHe: "אי חג המולד" },
  { iso2: "CC", dialCode: "+61", nameEn: "Cocos (Keeling) Islands", nameHe: "איי קוקוס" },
  { iso2: "CO", dialCode: "+57", nameEn: "Colombia", nameHe: "קולומביה" },
  { iso2: "KM", dialCode: "+269", nameEn: "Comoros", nameHe: "קומורו" },
  { iso2: "CG", dialCode: "+242", nameEn: "Congo", nameHe: "קונגו" },
  { iso2: "CD", dialCode: "+243", nameEn: "Congo, Democratic Republic of the", nameHe: "הרפובליקה הדמוקרטית של קונגו" },
  { iso2: "CK", dialCode: "+682", nameEn: "Cook Islands", nameHe: "איי קוק" },
  { iso2: "CR", dialCode: "+506", nameEn: "Costa Rica", nameHe: "קוסטה ריקה" },
  { iso2: "CI", dialCode: "+225", nameEn: "Côte d'Ivoire", nameHe: "חוף השנהב" },
  { iso2: "HR", dialCode: "+385", nameEn: "Croatia", nameHe: "קרואטיה" },
  { iso2: "CU", dialCode: "+53", nameEn: "Cuba", nameHe: "קובה" },
  { iso2: "CW", dialCode: "+599", nameEn: "Curaçao", nameHe: "קוראסאו" },
  { iso2: "CY", dialCode: "+357", nameEn: "Cyprus", nameHe: "קפריסין" },
  { iso2: "CZ", dialCode: "+420", nameEn: "Czechia", nameHe: "צ'כיה" },
  { iso2: "DK", dialCode: "+45", nameEn: "Denmark", nameHe: "דנמרק" },
  { iso2: "DJ", dialCode: "+253", nameEn: "Djibouti", nameHe: "ג'יבוטי" },
  { iso2: "DM", dialCode: "+1", nameEn: "Dominica", nameHe: "דומיניקה" },
  { iso2: "DO", dialCode: "+1", nameEn: "Dominican Republic", nameHe: "הרפובליקה הדומיניקנית" },
  { iso2: "EC", dialCode: "+593", nameEn: "Ecuador", nameHe: "אקוודור" },
  { iso2: "EG", dialCode: "+20", nameEn: "Egypt", nameHe: "מצרים" },
  { iso2: "SV", dialCode: "+503", nameEn: "El Salvador", nameHe: "אל סלבדור" },
  { iso2: "GQ", dialCode: "+240", nameEn: "Equatorial Guinea", nameHe: "גינאה המשוונית" },
  { iso2: "ER", dialCode: "+291", nameEn: "Eritrea", nameHe: "אריתריאה" },
  { iso2: "EE", dialCode: "+372", nameEn: "Estonia", nameHe: "אסטוניה" },
  { iso2: "SZ", dialCode: "+268", nameEn: "Eswatini", nameHe: "אסוואטיני" },
  { iso2: "ET", dialCode: "+251", nameEn: "Ethiopia", nameHe: "אתיופיה" },
  { iso2: "FK", dialCode: "+500", nameEn: "Falkland Islands", nameHe: "איי פוקלנד" },
  { iso2: "FO", dialCode: "+298", nameEn: "Faroe Islands", nameHe: "איי פארו" },
  { iso2: "FJ", dialCode: "+679", nameEn: "Fiji", nameHe: "פיג'י" },
  { iso2: "FI", dialCode: "+358", nameEn: "Finland", nameHe: "פינלנד" },
  { iso2: "FR", dialCode: "+33", nameEn: "France", nameHe: "צרפת" },
  { iso2: "GF", dialCode: "+594", nameEn: "French Guiana", nameHe: "גיאנה הצרפתית" },
  { iso2: "PF", dialCode: "+689", nameEn: "French Polynesia", nameHe: "פולינזיה הצרפתית" },
  { iso2: "TF", dialCode: "+262", nameEn: "French Southern Territories", nameHe: "הארצות הדרומיות והאנטארקטיות הצרפתיות" },
  { iso2: "GA", dialCode: "+241", nameEn: "Gabon", nameHe: "גבון" },
  { iso2: "GM", dialCode: "+220", nameEn: "Gambia", nameHe: "גמביה" },
  { iso2: "GE", dialCode: "+995", nameEn: "Georgia", nameHe: "גאורגיה" },
  { iso2: "DE", dialCode: "+49", nameEn: "Germany", nameHe: "גרמניה" },
  { iso2: "GH", dialCode: "+233", nameEn: "Ghana", nameHe: "גאנה" },
  { iso2: "GI", dialCode: "+350", nameEn: "Gibraltar", nameHe: "גיברלטר" },
  { iso2: "GR", dialCode: "+30", nameEn: "Greece", nameHe: "יוון" },
  { iso2: "GL", dialCode: "+299", nameEn: "Greenland", nameHe: "גרינלנד" },
  { iso2: "GD", dialCode: "+1", nameEn: "Grenada", nameHe: "גרנדה" },
  { iso2: "GP", dialCode: "+590", nameEn: "Guadeloupe", nameHe: "גוואדלופ" },
  { iso2: "GU", dialCode: "+1", nameEn: "Guam", nameHe: "גואם" },
  { iso2: "GT", dialCode: "+502", nameEn: "Guatemala", nameHe: "גואטמלה" },
  { iso2: "GG", dialCode: "+44", nameEn: "Guernsey", nameHe: "גרנזי" },
  { iso2: "GN", dialCode: "+224", nameEn: "Guinea", nameHe: "גינאה" },
  { iso2: "GW", dialCode: "+245", nameEn: "Guinea-Bissau", nameHe: "גינאה-ביסאו" },
  { iso2: "GY", dialCode: "+592", nameEn: "Guyana", nameHe: "גיאנה" },
  { iso2: "HT", dialCode: "+509", nameEn: "Haiti", nameHe: "האיטי" },
  { iso2: "HM", dialCode: "+672", nameEn: "Heard Island and McDonald Islands", nameHe: "איי הרד ומקדונלד" },
  { iso2: "VA", dialCode: "+39", nameEn: "Holy See", nameHe: "הכס הקדוש" },
  { iso2: "HN", dialCode: "+504", nameEn: "Honduras", nameHe: "הונדורס" },
  { iso2: "HK", dialCode: "+852", nameEn: "Hong Kong", nameHe: "הונג קונג" },
  { iso2: "HU", dialCode: "+36", nameEn: "Hungary", nameHe: "הונגריה" },
  { iso2: "IS", dialCode: "+354", nameEn: "Iceland", nameHe: "איסלנד" },
  { iso2: "IN", dialCode: "+91", nameEn: "India", nameHe: "הודו" },
  { iso2: "ID", dialCode: "+62", nameEn: "Indonesia", nameHe: "אינדונזיה" },
  { iso2: "IR", dialCode: "+98", nameEn: "Iran", nameHe: "איראן" },
  { iso2: "IQ", dialCode: "+964", nameEn: "Iraq", nameHe: "עיראק" },
  { iso2: "IE", dialCode: "+353", nameEn: "Ireland", nameHe: "אירלנד" },
  { iso2: "IM", dialCode: "+44", nameEn: "Isle of Man", nameHe: "האי מאן" },
  { iso2: "IL", dialCode: "+972", nameEn: "Israel", nameHe: "ישראל" },
  { iso2: "IT", dialCode: "+39", nameEn: "Italy", nameHe: "איטליה" },
  { iso2: "JM", dialCode: "+1", nameEn: "Jamaica", nameHe: "ג'מייקה" },
  { iso2: "JP", dialCode: "+81", nameEn: "Japan", nameHe: "יפן" },
  { iso2: "JE", dialCode: "+44", nameEn: "Jersey", nameHe: "ג'רזי" },
  { iso2: "JO", dialCode: "+962", nameEn: "Jordan", nameHe: "ירדן" },
  { iso2: "KZ", dialCode: "+7", nameEn: "Kazakhstan", nameHe: "קזחסטן" },
  { iso2: "KE", dialCode: "+254", nameEn: "Kenya", nameHe: "קניה" },
  { iso2: "KI", dialCode: "+686", nameEn: "Kiribati", nameHe: "קיריבטי" },
  { iso2: "KP", dialCode: "+850", nameEn: "Korea, North", nameHe: "קוריאה הצפונית" },
  { iso2: "KR", dialCode: "+82", nameEn: "Korea, South", nameHe: "קוריאה הדרומית" },
  { iso2: "KW", dialCode: "+965", nameEn: "Kuwait", nameHe: "כווית" },
  { iso2: "KG", dialCode: "+996", nameEn: "Kyrgyzstan", nameHe: "קירגיזסטן" },
  { iso2: "LA", dialCode: "+856", nameEn: "Laos", nameHe: "לאוס" },
  { iso2: "LV", dialCode: "+371", nameEn: "Latvia", nameHe: "לטביה" },
  { iso2: "LB", dialCode: "+961", nameEn: "Lebanon", nameHe: "לבנון" },
  { iso2: "LS", dialCode: "+266", nameEn: "Lesotho", nameHe: "לסוטו" },
  { iso2: "LR", dialCode: "+231", nameEn: "Liberia", nameHe: "ליבריה" },
  { iso2: "LY", dialCode: "+218", nameEn: "Libya", nameHe: "לוב" },
  { iso2: "LI", dialCode: "+423", nameEn: "Liechtenstein", nameHe: "ליכטנשטיין" },
  { iso2: "LT", dialCode: "+370", nameEn: "Lithuania", nameHe: "ליטא" },
  { iso2: "LU", dialCode: "+352", nameEn: "Luxembourg", nameHe: "לוקסמבורג" },
  { iso2: "MO", dialCode: "+853", nameEn: "Macao", nameHe: "מקאו" },
  { iso2: "MG", dialCode: "+261", nameEn: "Madagascar", nameHe: "מדגסקר" },
  { iso2: "MW", dialCode: "+265", nameEn: "Malawi", nameHe: "מלאווי" },
  { iso2: "MY", dialCode: "+60", nameEn: "Malaysia", nameHe: "מלזיה" },
  { iso2: "MV", dialCode: "+960", nameEn: "Maldives", nameHe: "האיים המלדיביים" },
  { iso2: "ML", dialCode: "+223", nameEn: "Mali", nameHe: "מאלי" },
  { iso2: "MT", dialCode: "+356", nameEn: "Malta", nameHe: "מלטה" },
  { iso2: "MH", dialCode: "+692", nameEn: "Marshall Islands", nameHe: "איי מרשל" },
  { iso2: "MQ", dialCode: "+596", nameEn: "Martinique", nameHe: "מרטיניק" },
  { iso2: "MR", dialCode: "+222", nameEn: "Mauritania", nameHe: "מאוריטניה" },
  { iso2: "MU", dialCode: "+230", nameEn: "Mauritius", nameHe: "מאוריציוס" },
  { iso2: "YT", dialCode: "+262", nameEn: "Mayotte", nameHe: "מאיוט" },
  { iso2: "MX", dialCode: "+52", nameEn: "Mexico", nameHe: "מקסיקו" },
  { iso2: "FM", dialCode: "+691", nameEn: "Micronesia", nameHe: "מיקרונזיה" },
  { iso2: "MD", dialCode: "+373", nameEn: "Moldova", nameHe: "מולדובה" },
  { iso2: "MC", dialCode: "+377", nameEn: "Monaco", nameHe: "מונקו" },
  { iso2: "MN", dialCode: "+976", nameEn: "Mongolia", nameHe: "מונגוליה" },
  { iso2: "ME", dialCode: "+382", nameEn: "Montenegro", nameHe: "מונטנגרו" },
  { iso2: "MS", dialCode: "+1", nameEn: "Montserrat", nameHe: "מונטסראט" },
  { iso2: "MA", dialCode: "+212", nameEn: "Morocco", nameHe: "מרוקו" },
  { iso2: "MZ", dialCode: "+258", nameEn: "Mozambique", nameHe: "מוזמביק" },
  { iso2: "MM", dialCode: "+95", nameEn: "Myanmar", nameHe: "מיאנמר" },
  { iso2: "NA", dialCode: "+264", nameEn: "Namibia", nameHe: "נמיביה" },
  { iso2: "NR", dialCode: "+674", nameEn: "Nauru", nameHe: "נאורו" },
  { iso2: "NP", dialCode: "+977", nameEn: "Nepal", nameHe: "נפאל" },
  { iso2: "NL", dialCode: "+31", nameEn: "Netherlands", nameHe: "הולנד" },
  { iso2: "NC", dialCode: "+687", nameEn: "New Caledonia", nameHe: "קלדוניה החדשה" },
  { iso2: "NZ", dialCode: "+64", nameEn: "New Zealand", nameHe: "ניו זילנד" },
  { iso2: "NI", dialCode: "+505", nameEn: "Nicaragua", nameHe: "ניקרגואה" },
  { iso2: "NE", dialCode: "+227", nameEn: "Niger", nameHe: "ניז'ר" },
  { iso2: "NG", dialCode: "+234", nameEn: "Nigeria", nameHe: "ניגריה" },
  { iso2: "NU", dialCode: "+683", nameEn: "Niue", nameHe: "ניואה" },
  { iso2: "NF", dialCode: "+672", nameEn: "Norfolk Island", nameHe: "אי נורפוק" },
  { iso2: "MK", dialCode: "+389", nameEn: "North Macedonia", nameHe: "מקדוניה הצפונית" },
  { iso2: "MP", dialCode: "+1", nameEn: "Northern Mariana Islands", nameHe: "איי מריאנה הצפוניים" },
  { iso2: "NO", dialCode: "+47", nameEn: "Norway", nameHe: "נורווגיה" },
  { iso2: "OM", dialCode: "+968", nameEn: "Oman", nameHe: "עומאן" },
  { iso2: "PK", dialCode: "+92", nameEn: "Pakistan", nameHe: "פקיסטן" },
  { iso2: "PW", dialCode: "+680", nameEn: "Palau", nameHe: "פלאו" },
  { iso2: "PS", dialCode: "+970", nameEn: "Palestine", nameHe: "פלסטין" },
  { iso2: "PA", dialCode: "+507", nameEn: "Panama", nameHe: "פנמה" },
  { iso2: "PG", dialCode: "+675", nameEn: "Papua New Guinea", nameHe: "פפואה גינאה החדשה" },
  { iso2: "PY", dialCode: "+595", nameEn: "Paraguay", nameHe: "פרגוואי" },
  { iso2: "PE", dialCode: "+51", nameEn: "Peru", nameHe: "פרו" },
  { iso2: "PH", dialCode: "+63", nameEn: "Philippines", nameHe: "הפיליפינים" },
  { iso2: "PN", dialCode: "+64", nameEn: "Pitcairn", nameHe: "פיטקרן" },
  { iso2: "PL", dialCode: "+48", nameEn: "Poland", nameHe: "פולין" },
  { iso2: "PT", dialCode: "+351", nameEn: "Portugal", nameHe: "פורטוגל" },
  { iso2: "PR", dialCode: "+1", nameEn: "Puerto Rico", nameHe: "פוארטו ריקו" },
  { iso2: "QA", dialCode: "+974", nameEn: "Qatar", nameHe: "קטאר" },
  { iso2: "RE", dialCode: "+262", nameEn: "Réunion", nameHe: "ראוניון" },
  { iso2: "RO", dialCode: "+40", nameEn: "Romania", nameHe: "רומניה" },
  { iso2: "RU", dialCode: "+7", nameEn: "Russia", nameHe: "רוסיה" },
  { iso2: "RW", dialCode: "+250", nameEn: "Rwanda", nameHe: "רואנדה" },
  { iso2: "BL", dialCode: "+590", nameEn: "Saint Barthélemy", nameHe: "סן ברתלמי" },
  { iso2: "SH", dialCode: "+290", nameEn: "Saint Helena, Ascension and Tristan da Cunha", nameHe: "סנט הלנה" },
  { iso2: "KN", dialCode: "+1", nameEn: "Saint Kitts and Nevis", nameHe: "סנט קיטס ונוויס" },
  { iso2: "LC", dialCode: "+1", nameEn: "Saint Lucia", nameHe: "סנט לוסיה" },
  { iso2: "MF", dialCode: "+590", nameEn: "Saint Martin (French part)", nameHe: "סן מרטן" },
  { iso2: "PM", dialCode: "+508", nameEn: "Saint Pierre and Miquelon", nameHe: "סן פייר ומיקלון" },
  { iso2: "VC", dialCode: "+1", nameEn: "Saint Vincent and the Grenadines", nameHe: "סנט וינסנט והגרנדינים" },
  { iso2: "WS", dialCode: "+685", nameEn: "Samoa", nameHe: "סמואה" },
  { iso2: "SM", dialCode: "+378", nameEn: "San Marino", nameHe: "סן מרינו" },
  { iso2: "ST", dialCode: "+239", nameEn: "Sao Tome and Principe", nameHe: "סאו טומה ופרינסיפה" },
  { iso2: "SA", dialCode: "+966", nameEn: "Saudi Arabia", nameHe: "ערב הסעודית" },
  { iso2: "SN", dialCode: "+221", nameEn: "Senegal", nameHe: "סנגל" },
  { iso2: "RS", dialCode: "+381", nameEn: "Serbia", nameHe: "סרביה" },
  { iso2: "SC", dialCode: "+248", nameEn: "Seychelles", nameHe: "איי סיישל" },
  { iso2: "SL", dialCode: "+232", nameEn: "Sierra Leone", nameHe: "סיירה לאון" },
  { iso2: "SG", dialCode: "+65", nameEn: "Singapore", nameHe: "סינגפור" },
  { iso2: "SX", dialCode: "+1", nameEn: "Sint Maarten (Dutch part)", nameHe: "סינט מארטן" },
  { iso2: "SK", dialCode: "+421", nameEn: "Slovakia", nameHe: "סלובקיה" },
  { iso2: "SI", dialCode: "+386", nameEn: "Slovenia", nameHe: "סלובניה" },
  { iso2: "SB", dialCode: "+677", nameEn: "Solomon Islands", nameHe: "איי שלמה" },
  { iso2: "SO", dialCode: "+252", nameEn: "Somalia", nameHe: "סומליה" },
  { iso2: "ZA", dialCode: "+27", nameEn: "South Africa", nameHe: "דרום אפריקה" },
  { iso2: "GS", dialCode: "+500", nameEn: "South Georgia and the South Sandwich Islands", nameHe: "ג'ורג'יה הדרומית ואיי סנדוויץ' הדרומיים" },
  { iso2: "SS", dialCode: "+211", nameEn: "South Sudan", nameHe: "דרום סודאן" },
  { iso2: "ES", dialCode: "+34", nameEn: "Spain", nameHe: "ספרד" },
  { iso2: "LK", dialCode: "+94", nameEn: "Sri Lanka", nameHe: "סרי לנקה" },
  { iso2: "SD", dialCode: "+249", nameEn: "Sudan", nameHe: "סודאן" },
  { iso2: "SR", dialCode: "+597", nameEn: "Suriname", nameHe: "סורינאם" },
  { iso2: "SJ", dialCode: "+47", nameEn: "Svalbard and Jan Mayen", nameHe: "סבאלברד ויאן מאיין" },
  { iso2: "SE", dialCode: "+46", nameEn: "Sweden", nameHe: "שוודיה" },
  { iso2: "CH", dialCode: "+41", nameEn: "Switzerland", nameHe: "שווייץ" },
  { iso2: "SY", dialCode: "+963", nameEn: "Syria", nameHe: "סוריה" },
  { iso2: "TW", dialCode: "+886", nameEn: "Taiwan", nameHe: "טייוואן" },
  { iso2: "TJ", dialCode: "+992", nameEn: "Tajikistan", nameHe: "טג'יקיסטן" },
  { iso2: "TZ", dialCode: "+255", nameEn: "Tanzania", nameHe: "טנזניה" },
  { iso2: "TH", dialCode: "+66", nameEn: "Thailand", nameHe: "תאילנד" },
  { iso2: "TL", dialCode: "+670", nameEn: "Timor-Leste", nameHe: "מזרח טימור" },
  { iso2: "TG", dialCode: "+228", nameEn: "Togo", nameHe: "טוגו" },
  { iso2: "TK", dialCode: "+690", nameEn: "Tokelau", nameHe: "טוקלאו" },
  { iso2: "TO", dialCode: "+676", nameEn: "Tonga", nameHe: "טונגה" },
  { iso2: "TT", dialCode: "+1", nameEn: "Trinidad and Tobago", nameHe: "טרינידד וטובגו" },
  { iso2: "TN", dialCode: "+216", nameEn: "Tunisia", nameHe: "תוניסיה" },
  { iso2: "TR", dialCode: "+90", nameEn: "Turkey", nameHe: "טורקיה" },
  { iso2: "TM", dialCode: "+993", nameEn: "Turkmenistan", nameHe: "טורקמניסטן" },
  { iso2: "TC", dialCode: "+1", nameEn: "Turks and Caicos Islands", nameHe: "איי טורקס וקייקוס" },
  { iso2: "TV", dialCode: "+688", nameEn: "Tuvalu", nameHe: "טובאלו" },
  { iso2: "UG", dialCode: "+256", nameEn: "Uganda", nameHe: "אוגנדה" },
  { iso2: "UA", dialCode: "+380", nameEn: "Ukraine", nameHe: "אוקראינה" },
  { iso2: "AE", dialCode: "+971", nameEn: "United Arab Emirates", nameHe: "איחוד האמירויות הערביות" },
  { iso2: "GB", dialCode: "+44", nameEn: "United Kingdom", nameHe: "הממלכה המאוחדת" },
  { iso2: "US", dialCode: "+1", nameEn: "United States", nameHe: "ארצות הברית" },
  { iso2: "UM", dialCode: "+1", nameEn: "United States Minor Outlying Islands", nameHe: "האיים הקטנים המרוחקים של ארצות הברית" },
  { iso2: "UY", dialCode: "+598", nameEn: "Uruguay", nameHe: "אורוגוואי" },
  { iso2: "UZ", dialCode: "+998", nameEn: "Uzbekistan", nameHe: "אוזבקיסטן" },
  { iso2: "VU", dialCode: "+678", nameEn: "Vanuatu", nameHe: "ונואטו" },
  { iso2: "VE", dialCode: "+58", nameEn: "Venezuela", nameHe: "ונצואלה" },
  { iso2: "VN", dialCode: "+84", nameEn: "Vietnam", nameHe: "וייטנאם" },
  { iso2: "VG", dialCode: "+1", nameEn: "Virgin Islands (British)", nameHe: "איי הבתולה הבריטיים" },
  { iso2: "VI", dialCode: "+1", nameEn: "Virgin Islands (U.S.)", nameHe: "איי הבתולה של ארצות הברית" },
  { iso2: "WF", dialCode: "+681", nameEn: "Wallis and Futuna", nameHe: "ואליס ופוטונה" },
  { iso2: "EH", dialCode: "+212", nameEn: "Western Sahara", nameHe: "סהרה המערבית" },
  { iso2: "YE", dialCode: "+967", nameEn: "Yemen", nameHe: "תימן" },
  { iso2: "ZM", dialCode: "+260", nameEn: "Zambia", nameHe: "זמביה" },
  { iso2: "ZW", dialCode: "+263", nameEn: "Zimbabwe", nameHe: "זימבבואה" },
]

/**
 * Case-insensitive ISO2 to {@link Country} index, built once at module load.
 *
 * Backs the O(1) {@link countryByIso2} lookup; keys are uppercase ISO2 codes.
 */
const BY_ISO2: Map<string, Country> = new Map(
  COUNTRIES.map((country) => [country.iso2, country]),
)

/**
 * Derive the Unicode flag emoji for an ISO 3166-1 alpha-2 code.
 *
 * Each ASCII letter of the uppercased code maps to its regional-indicator
 * symbol (codepoint `0x1F1E6 + (charCodeAt - 0x41)`); the two symbols combine
 * into the flag glyph.
 *
 * @param iso2 - ISO 3166-1 alpha-2 code (case-insensitive).
 * @returns The two-codepoint regional-indicator flag string, or `""` when the
 *   input is not exactly two ASCII letters (guards against `RangeError`).
 */
export function flagEmoji(iso2: string): string {
  if (!/^[A-Za-z]{2}$/.test(iso2)) return ""
  const base = 0x1f1e6
  const upper = iso2.toUpperCase()
  return String.fromCodePoint(
    base + (upper.charCodeAt(0) - 0x41),
    base + (upper.charCodeAt(1) - 0x41),
  )
}

/**
 * Look up a country by ISO 3166-1 alpha-2 code (case-insensitive).
 *
 * @param iso2 - ISO2 code in any case.
 * @returns The matching {@link Country}, or `undefined` if the code is unknown.
 */
export function countryByIso2(iso2: string): Country | undefined {
  return BY_ISO2.get(iso2.toUpperCase())
}
