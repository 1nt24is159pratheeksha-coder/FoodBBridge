# Initial frontend foundation
- [x] Build demo login with four-role selection.
- [x] Build responsive sidebar and kitchen dashboard with simulated metrics/statuses.
- [x] Verify login-to-dashboard and mobile navigation.

# Role-based structure
- [x] Per-role navigation and dashboards (Kitchen, NGO, Driver, Admin) with role switcher.

# Kitchen Add Surplus
- [x] Add Surplus form, confirmation card with demo priority rules, surplus listing in Food Inventory (session state).

# Shared Kitchen/NGO data
- [x] Browser-saved surplus shared by Kitchen and NGO; NGO Available Food with Request Food.

# NGO accept/reject workflow
- [x] NGO Accept/Reject, Kitchen NGO Requests, Kitchen notifications, NGO My Requests, status updates.

# Food Assessment
- [x] Simulated photo assessment, editable estimates, quality screening, saved to shared surplus, shown to NGO.

# Delivery & Driver workflow
- [x] Deliveries created on NGO accept, driver step flow with demo OTP, shared status across roles, notifications, driver history.

# Two-role web (Admin + Driver), WhatsApp-first Kitchen/NGO
- [x] Web roles reduced to Admin + Driver; old kitchen/ngo links fall back to Admin.
- [x] Admin command center sections (overview, kitchens, NGOs, drivers, registrations, surplus, assessments, allocations, deliveries, notifications, impact, reports) reusing existing components.
- [x] Entity types (users, kitchens, recipients, drivers, surplus_food, food_assessments, allocations, deliveries, notifications, impact_metrics, whatsapp_messages) + lifecycle states.
- [x] Mobile-first driver view. WhatsApp itself is out of scope for now.

# WhatsApp food-photo analysis (real)
- [x] Cloud tables, Twilio webhook, AI vision, confirm/correct/reject flow, Admin Assessments view + tester.
- [ ] Link Twilio and set webhook URL in Twilio console (needs user).
