const config = {
      theme: {
        extend: {
          colors: {
            ink: "var(--color-ink)",
            navy: "var(--color-navy)",
            "navy-soft": "var(--color-navy-soft)",
            "on-navy": "var(--color-on-navy)",
            "on-accent": "var(--color-on-accent)",
            "ink-soft": "var(--color-ink-soft)",
            copy: "var(--color-body)",
            muted: "var(--color-muted-text)",
            page: "var(--color-page)",
            surface: "var(--color-surface)",
            accent: "var(--color-accent)",
            "accent-dark": "var(--color-accent-dark)",
            line: "var(--color-line)",
            placeholder: "var(--color-placeholder)"
          },
          fontFamily: {
            inter: ["Inter", "sans-serif"]
          },
          fontSize: {
            caption: "var(--font-size-xs)",
            small: "var(--font-size-sm)",
            copy: "var(--font-size-base)",
            lead: "var(--font-size-lead)",
            brand: "var(--font-size-brand)"
          },
          spacing: {
            "ui-1": "var(--space-1)",
            "ui-2": "var(--space-2)",
            "ui-3": "var(--space-3)",
            "ui-4": "var(--space-4)",
            "ui-5": "var(--space-5)",
            "ui-6": "var(--space-6)",
            "ui-7": "var(--space-7)",
            "ui-8": "var(--space-8)"
          },
          borderRadius: {
            "ui-sm": "var(--radius-sm)",
            "ui-md": "var(--radius-md)"
          },
          boxShadow: {
            card: "var(--shadow-card)"
          },
          transitionDuration: {
            180: "180ms"
          },
          screens: {
            nav: "901px"
          }
        }
      }
    };
config.content = ["./*.html", "./js/**/*.js"];
module.exports = config;
