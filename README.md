# ResQFood Frontend Foundation

Build the initial frontend foundation for a web application called "ResQFood AI".

Purpose:

ResQFood AI is an AI-powered food surplus management and redistribution platform for institutional kitchens, NGOs/recipients, and delivery drivers.

For this first step, focus ONLY on the application structure and professional UI. Do not build WhatsApp integration, external APIs, AI image analysis, voice processing, or complex backend logic yet.

Create:

1. A modern login page for ResQFood AI.

2. A clean sidebar navigation layout for the main application.

3. A responsive dashboard shell.

4. Role selection/support for these roles:

   - Kitchen / Food Provider

   - NGO / Recipient

   - Driver

   - Admin

5. A Kitchen dashboard as the initial default dashboard.

Kitchen dashboard should visually show:

- Today's predicted food requirement

- Food prepared

- Current surplus

- Food rescued

- Active rescue requests

- Pending NGO responses

- Active deliveries

- Food waste prevented

Add dashboard cards with realistic DEMO values, clearly treated as simulated data.

Add navigation items:

- Dashboard

- Food Inventory

- Add Surplus

- Food Assessment

- NGO Requests

- Deliveries

- Notifications

- Impact

- Settings

Design requirements:

- Professional but simple

- Clean modern SaaS dashboard

- Easy to understand during a hackathon demonstration

- Responsive desktop/tablet/mobile layout

- Use clear status badges such as Available, Pending, Accepted, Urgent and Delivered

- Use food-rescue themed visual language without making the interface cluttered

- Use charts/placeholders where appropriate, but keep them lightweight

- Do not add unnecessary pages or features yet

Important:

Create reusable components and a structure that we can extend in later prompts.

Do not rebuild or redesign the application from scratch in later steps.

Preserve this design system and navigation structure when adding future functionality.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/44721029-3f89-58cf-aea7-fe6a931d64e8).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
