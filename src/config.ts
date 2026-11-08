// App identity and locale. Shared by the server (prompts, storage) and the client (UI copy).

export const APP = {
  /** Shown in the nav rail, login screen and browser tab. */
  name: 'Ötzi Signal',
  /** One line under the name on the login screen. */
  tagline: 'The oldest art on skin, read by a new kind of mind.',
  /** What the assistant calls itself in replies and in the activity timeline. */
  assistantName: 'Ötzi',
  /** Short id used for storage: table prefix (`<id>_settings`), settings file (`data/<id>-settings.json`), cookie name. */
  id: 'otzi',
  /** Default UI language and date formatting. The super admin can switch the UI and replies to Polish. */
  locale: 'en-GB',
  timezone: 'Europe/London',
  /** Where web searches are localised (only used by the text engines' optional web tools). */
  userLocation: { type: 'approximate', country: 'GB', city: 'London', timezone: 'Europe/London' },
} as const;

export type Effort = 'low' | 'medium' | 'high';
