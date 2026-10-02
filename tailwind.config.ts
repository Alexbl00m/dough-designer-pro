import type { Config } from "tailwindcss";

export default {
	darkMode: ["class"],
	content: [
		"./pages/**/*.{ts,tsx}",
		"./components/**/*.{ts,tsx}",
		"./app/**/*.{ts,tsx}",
		"./src/**/*.{ts,tsx}",
	],
	prefix: "",
	theme: {
		container: {
			center: true,
			padding: '2rem',
			screens: {
				'2xl': '1400px'
			}
		},
		extend: {
			/*
			 * One ladder, applied everywhere. Sizes above 20px carry negative
			 * tracking so a large heading reads as one shape instead of a row of
			 * letters; body and below sit at normal or slightly tight.
			 */
			fontSize: {
				'display-xl': ['3.25rem', { lineHeight: '1.07', letterSpacing: '-0.035em', fontWeight: '600' }],
				'display-lg': ['2.5rem', { lineHeight: '1.1', letterSpacing: '-0.03em', fontWeight: '600' }],
				'display-md': ['1.75rem', { lineHeight: '1.18', letterSpacing: '-0.025em', fontWeight: '600' }],
				'display-sm': ['1.3125rem', { lineHeight: '1.25', letterSpacing: '-0.02em', fontWeight: '600' }],
				lead: ['1.3125rem', { lineHeight: '1.45', letterSpacing: '-0.01em', fontWeight: '400' }],
				'body-lg': ['1.1875rem', { lineHeight: '1.5', letterSpacing: '-0.011em' }],
				body: ['1.0625rem', { lineHeight: '1.47', letterSpacing: '-0.011em' }],
				'body-sm': ['0.9375rem', { lineHeight: '1.45', letterSpacing: '-0.008em' }],
				caption: ['0.875rem', { lineHeight: '1.43', letterSpacing: '-0.006em' }],
				micro: ['0.75rem', { lineHeight: '1.35', letterSpacing: '0' }],
			},
			colors: {
				border: 'hsl(var(--border))',
				hairline: 'hsl(var(--hairline))',
				input: 'hsl(var(--input))',
				ring: 'hsl(var(--ring))',
				background: 'hsl(var(--background))',
				foreground: 'hsl(var(--foreground))',
				primary: {
					DEFAULT: 'hsl(var(--primary))',
					foreground: 'hsl(var(--primary-foreground))',
					hover: 'hsl(var(--primary-hover))',
					glow: 'hsl(var(--primary-glow))',
					soft: 'hsl(var(--primary-soft))'
				},
				secondary: {
					DEFAULT: 'hsl(var(--secondary))',
					foreground: 'hsl(var(--secondary-foreground))',
					hover: 'hsl(var(--secondary-hover))'
				},
				destructive: {
					DEFAULT: 'hsl(var(--destructive))',
					foreground: 'hsl(var(--destructive-foreground))'
				},
				muted: {
					DEFAULT: 'hsl(var(--muted))',
					foreground: 'hsl(var(--muted-foreground))'
				},
				accent: {
					DEFAULT: 'hsl(var(--accent))',
					foreground: 'hsl(var(--accent-foreground))'
				},
				popover: {
					DEFAULT: 'hsl(var(--popover))',
					foreground: 'hsl(var(--popover-foreground))'
				},
				card: {
					DEFAULT: 'hsl(var(--card))',
					foreground: 'hsl(var(--card-foreground))',
					muted: 'hsl(var(--card-muted))'
				},
				success: 'hsl(var(--success))',
				warning: 'hsl(var(--warning))',
				info: 'hsl(var(--info))',
				ing: {
					flour: 'hsl(var(--ing-flour))',
					water: 'hsl(var(--ing-water))',
					salt: 'hsl(var(--ing-salt))',
					yeast: 'hsl(var(--ing-yeast))',
					starter: 'hsl(var(--ing-starter))',
					fat: 'hsl(var(--ing-fat))',
					sugar: 'hsl(var(--ing-sugar))',
					dairy: 'hsl(var(--ing-dairy))',
					egg: 'hsl(var(--ing-egg))',
					other: 'hsl(var(--ing-other))'
				},
				sidebar: {
					DEFAULT: 'hsl(var(--sidebar-background))',
					foreground: 'hsl(var(--sidebar-foreground))',
					primary: 'hsl(var(--sidebar-primary))',
					'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
					accent: 'hsl(var(--sidebar-accent))',
					'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
					border: 'hsl(var(--sidebar-border))',
					ring: 'hsl(var(--sidebar-ring))'
				}
			},
			/*
			 * Three grammars and nothing between them: compact utility, cards, and
			 * the pill that means "this is an action".
			 */
			borderRadius: {
				lg: 'var(--radius)',
				md: 'calc(var(--radius) - 2px)',
				sm: 'calc(var(--radius) - 4px)',
				utility: '0.5rem',
				card: '1.125rem',
				pill: '9999px'
			},
			keyframes: {
				'accordion-down': {
					from: {
						height: '0'
					},
					to: {
						height: 'var(--radix-accordion-content-height)'
					}
				},
				'accordion-up': {
					from: {
						height: 'var(--radix-accordion-content-height)'
					},
					to: {
						height: '0'
					}
				},
				'fade-up': {
					from: { opacity: '0', transform: 'translateY(8px)' },
					to: { opacity: '1', transform: 'translateY(0)' }
				}
			},
			animation: {
				'accordion-down': 'accordion-down 0.2s ease-out',
				'accordion-up': 'accordion-up 0.2s ease-out',
				'fade-up': 'fade-up 0.35s cubic-bezier(0.16, 1, 0.3, 1) both'
			},
			/* Exactly one shadow exists, and it is for floating, not for hierarchy. */
			boxShadow: {
				float: 'var(--shadow-float)'
			},
			spacing: {
				section: '5rem'
			}
		}
	},
	plugins: [require("tailwindcss-animate")],
} satisfies Config;
