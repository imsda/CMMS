# UI Preview Bundle

The standalone preview files live in `/Users/calebdurant/Downloads/CMMS-main/public/ui-preview`.

Open them in either of these ways:

- Directly in a browser by opening `/Users/calebdurant/Downloads/CMMS-main/public/ui-preview/index.html`
- Through the app's static file server at `/ui-preview/index.html`

Included screens:

- Role map
- Role menus comparison
- Mobile navigation comparison
- Same screen, different roles comparison
- State gallery
- Click path walkthroughs
- Create event preview
- Dynamic question styles preview
- Login
- Admin dashboard
- Director dashboard
- Registration flow
- Roster page
- Class assignment page
- Student portal
- Teacher dashboard
- Teacher class page

Mock data is summarized in `/Users/calebdurant/Downloads/CMMS-main/public/ui-preview/mock-data.json` and grouped by screen. The HTML pages are static snapshots built from those same scenarios, so you can inspect layout, spacing, table density, badges, and empty states without Prisma, auth, server actions, or environment setup.

If your main concern is role navigation, start with `/Users/calebdurant/Downloads/CMMS-main/public/ui-preview/role-menus.html`. That page compares the Super Admin and Club Director sidebars directly, then also shows the smaller Student / Parent and Teacher menus for completeness.

Suggested review order:

- `/Users/calebdurant/Downloads/CMMS-main/public/ui-preview/role-map.html`
- `/Users/calebdurant/Downloads/CMMS-main/public/ui-preview/role-menus.html`
- `/Users/calebdurant/Downloads/CMMS-main/public/ui-preview/mobile-nav.html`
- `/Users/calebdurant/Downloads/CMMS-main/public/ui-preview/same-screen-roles.html`
- `/Users/calebdurant/Downloads/CMMS-main/public/ui-preview/state-gallery.html`
- `/Users/calebdurant/Downloads/CMMS-main/public/ui-preview/click-paths.html`
- `/Users/calebdurant/Downloads/CMMS-main/public/ui-preview/create-event.html`
- `/Users/calebdurant/Downloads/CMMS-main/public/ui-preview/question-styles.html`
