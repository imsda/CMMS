# UI Preview Bundle

The standalone preview files live in `/Users/calebdurant/Downloads/CMMS-main/public/ui-preview`.

Open them in either of these ways:

- Directly in a browser by opening `/Users/calebdurant/Downloads/CMMS-main/public/ui-preview/index.html`
- Through the app's static file server at `/ui-preview/index.html`

Included screens:

- Role menus comparison
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
