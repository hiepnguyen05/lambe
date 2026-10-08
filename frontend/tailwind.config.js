/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f0fdfa', 100: '#ccfbf1', 200: '#99f6e4', 300: '#5eead4', 400: '#2dd4bf', 500: '#14b8a6', 600: '#0d9488', 700: '#0f766e', 800: '#115e59', 900: '#134e4a', 950: '#042f2e',
        },
        primary: {
          DEFAULT: '#005c55', container: '#0f766e', dark: '#0d5f58', light: '#f0fdfa', accent: '#2dd4bf'
        },
        surface: {
          DEFAULT: '#f8f9ff', card: '#ffffff', subtle: '#eff4ff',
        },
        // M3 Colors from user sample
        "tertiary-container":"#606c6a",
        "primary-fixed":"#9cf2e8",
        "outline-variant":"#bdc9c6",
        "inverse-primary":"#80d5cb",
        "on-tertiary-fixed":"#121e1c",
        "surface-container-low":"#eff4ff",
        "on-secondary":"#ffffff",
        "on-error-container":"#93000a",
        "secondary-container":"#ffbe98",
        "tertiary":"#485452",
        "on-secondary-container":"#7a4b2d",
        "secondary":"#835335",
        "on-tertiary-fixed-variant":"#3d4947",
        "tertiary-fixed-dim":"#bcc9c6",
        "on-surface-variant":"#3e4947",
        "error":"#ba1a1a",
        "secondary-fixed":"#ffdbc8",
        "on-tertiary":"#ffffff",
        "surface-variant":"#d3e4fe",
        "primary-container":"#0f766e",
        "surface-dim":"#cbdbf5",
        "on-secondary-fixed":"#321200",
        "on-error":"#ffffff",
        "secondary-fixed-dim":"#f9b993",
        "background":"#f8f9ff",
        "on-background":"#0b1c30",
        "on-secondary-fixed-variant":"#683c1f",
        "primary-fixed-dim":"#80d5cb",
        "inverse-surface":"#213145",
        "surface-container":"#e5eeff",
        "tertiary-fixed":"#d8e5e2",
        "surface-container-lowest":"#ffffff",
        "surface-container-high":"#dce9ff",
        "error-container":"#ffdad6",
        "outline":"#6e7977",
        "surface-tint":"#006a63",
        "surface-container-highest":"#d3e4fe",
        "on-tertiary-container":"#e0edea",
        "on-primary-fixed-variant":"#00504a",
        "on-surface":"#0b1c30",
        "on-primary":"#ffffff",
        "on-primary-fixed":"#00201d",
        "surface-bright":"#f8f9ff",
        "on-primary-container":"#a3faef",
        "inverse-on-surface":"#eaf1ff"
      },
      spacing: {
        "margin-tablet":"2rem",
        "space-lg":"1.5rem",
        "space-xs":"0.25rem",
        "gutter-sm":"0.75rem",
        "space-sm":"0.5rem",
        "gutter":"1rem",
        "space-xl":"2rem",
        "margin":"1rem",
        "margin-desktop":"4rem",
        "space-md":"1rem"
      },
      fontSize: {
        "body-md":["14px",{lineHeight:"20px",fontWeight:"400"}],
        "label-lg":["14px",{lineHeight:"20px",letterSpacing:"0.01em",fontWeight:"600"}],
        "headline-md":["20px",{lineHeight:"28px",letterSpacing:"-0.01em",fontWeight:"600"}],
        "label-sm":["10px",{lineHeight:"14px",letterSpacing:"0.04em",fontWeight:"700"}],
        "headline-sm":["18px",{lineHeight:"24px",fontWeight:"600"}],
        "label-md":["12px",{lineHeight:"16px",letterSpacing:"0.02em",fontWeight:"600"}],
        "display-lg":["36px",{lineHeight:"44px",letterSpacing:"-0.02em",fontWeight:"700"}],
        "body-sm":["12px",{lineHeight:"18px",fontWeight:"400"}],
        "title-md":["16px",{lineHeight:"22px",fontWeight:"600"}],
        "body-lg":["16px",{lineHeight:"24px",fontWeight:"400"}],
        "headline-lg":["28px",{lineHeight:"36px",letterSpacing:"-0.02em",fontWeight:"700"}],
        "headline-lg-mobile":["24px",{lineHeight:"32px",letterSpacing:"-0.01em",fontWeight:"700"}]
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      boxShadow: {
        'card': '0 1px 3px 0 rgba(0, 0, 0, 0.05), 0 1px 2px -1px rgba(0, 0, 0, 0.05)',
        'elevated': '0 10px 25px -3px rgba(15, 118, 110, 0.1), 0 4px 6px -4px rgba(15, 23, 42, 0.04)',
        'drawer': '-10px 0 35px -5px rgba(15, 23, 42, 0.15)',
      }
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
    require('@tailwindcss/container-queries')
  ],
}
