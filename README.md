# Orange Taxi

## Premium Electric Mobility Platform

Orange Taxi is a premium electric taxi and mobility platform launching in Delhi, India.

The core positioning is:

> **Premium rides. Without the premium price.**

Orange Taxi aims to provide a significantly better ride experience than a regular taxi while remaining accessible enough for everyday use.

The platform will eventually support:

- Passengers
- Drivers
- Fleet operations
- Corporate customers
- Admins
- Bookings
- Pricing
- Payments
- Driver onboarding
- Customer support

---

# 1. BRAND

## Brand Personality

Orange Taxi should feel:

- Premium
- Elegant
- Friendly
- Warm
- Trustworthy
- Modern
- Human
- Effortless
- Accessible
- Sustainable

It should NOT feel:

- Cheap
- Generic
- Overly corporate
- Overly futuristic
- Aggressively tech-focused
- Cluttered
- Like a copy of Uber or Ola

Orange Taxi is selling an **experience**, not simply transportation.

---

# 2. VISUAL DESIGN

## Color Direction

Use:

- Warm ivory / off-white
- Deep charcoal / near-black
- Orange as the primary brand accent
- Neutral grey
- Optional muted green for EV/sustainability information

Orange should primarily be used for:

- Primary CTA buttons
- Highlights
- Important UI states
- Small accents
- Icons
- Brand details

Do not make the entire website orange.

The premium feeling should come from:

- Typography
- Photography
- Whitespace
- Layout
- Composition
- Subtle animation

---

# 3. WEBSITE

Build a production-quality responsive React website.

## Main Navigation

Navigation:

- Home
- Experience
- Electric
- For Business
- Drive With Us
- About
- Contact

Primary CTA:

**Book a Ride**

---

# 4. HOMEPAGE

## Hero

Headline:

> Premium rides. Without the premium price.

Supporting text:

> Premium electric cars, professional drivers and thoughtful service — designed to make every journey feel a little better.

Buttons:

- Book a Ride
- Explore the Orange Experience

Use cinematic premium electric vehicle photography.

---

# 5. VALUE PROPOSITION

Headline:

> More than a ride.

Show:

### Complimentary Water
A little refreshment waiting when you arrive.

### Pre-Cooled Cabin
Step into a comfortable car, not a hot one.

### Professional Drivers
Trained, courteous and committed to better service.

### Premium Electric Vehicles
Quiet, smooth and thoughtfully maintained.

---

# 6. ORANGE EXPERIENCE

Show the passenger journey:

1. Your car arrives clean and ready.
2. Your driver greets you professionally.
3. A bottle of water is waiting.
4. The cabin is cool and comfortable.
5. The journey is quiet and smooth.
6. You arrive feeling taken care of.

This section should feel closer to a premium hospitality brand than a traditional taxi company.

---

# 7. PRICE / VALUE

Headline:

> Premium shouldn't mean overpriced.

Position Orange Taxi between:

### Everyday Cab
Basic transportation

### Orange Taxi
Premium EV + thoughtful service + professional driver

### Luxury Chauffeur
Premium experience + significantly higher price

Do NOT invent exact competitor prices.

Actual pricing must eventually come from the backend pricing system.

---

# 8. ELECTRIC VEHICLES

Headline:

> Quiet rides. Cleaner cities.

Show:

- 100% Electric Fleet
- Quiet & Smooth
- Lower Running Costs
- Designed for the Future

EV should support the premium experience rather than dominate the brand.

---

# 9. VEHICLES

Create a premium vehicle showcase.

Initial vehicle category:

### Orange Premium

- Premium EV
- Spacious cabin
- Air conditioning
- Complimentary water
- Professional driver
- Smooth electric ride

Do not invent vehicle manufacturers or models unless they are provided later.

Vehicle categories should eventually be loaded from the database.

---

# 10. DRIVER EXPERIENCE

Headline:

> Great rides start with great people.

Explain:

- Professional training
- Customer-first service
- Safety-focused driving
- Service standards
- Driver onboarding

CTA:

**Drive With Orange**

The driver application should eventually connect to the real backend.

---

# 11. BUSINESS / CORPORATE

Headline:

> Better rides for your business.

Features:

- Corporate bookings
- Employee transportation
- Airport transfers
- Client transportation
- Centralized billing
- Ride management

CTA:

**Talk to Orange**

Corporate enquiries should eventually be stored in the backend.

---

# 12. HOW IT WORKS

Simple 3-step section.

### 01 — Book
Choose where you're going.

### 02 — Ride
Your Orange arrives.

### 03 — Enjoy
Sit back and enjoy the experience.

---

# 13. TESTIMONIALS

Use placeholder testimonials only.

Do NOT fabricate real customers, companies or reviews.

Clearly mark demo/placeholder testimonials so they can be replaced later.

---

# 14. FAQ

Include:

- What is Orange Taxi?
- Are Orange Taxi vehicles electric?
- How is Orange Taxi different from regular cabs?
- What makes Orange Taxi premium?
- How much does an Orange ride cost?
- Where is Orange Taxi available?
- How can I become an Orange driver?
- Do you offer corporate transportation?

Use expandable accordion components.

---

# 15. FOOTER

Include:

### Navigation

- Home
- Experience
- Electric
- Business
- Drive With Us
- About
- Contact
- Support

### Legal

- Privacy Policy
- Terms & Conditions

Social links can remain placeholders until official accounts are available.

---

# 16. BACKEND

The platform will use **Supabase** as the backend.

The frontend should connect to the existing Supabase project rather than creating a separate fake backend.

The backend will eventually handle:

- Authentication
- Customer profiles
- Driver profiles
- Driver applications
- Bookings
- Vehicle categories
- Pricing
- Service areas
- Corporate enquiries
- User roles
- Payments
- Booking status
- Driver assignment
- Admin operations

Existing database areas include:

- `profiles`
- `bookings`
- `drivers`
- `driver_applications`
- `pricing_settings`
- `service_areas`
- `vehicle_categories`
- `corporate_enquiries`
- `user_roles`

Do not create duplicate tables if the required table already exists.

Before modifying the database, inspect the existing schema.

---

# 17. AUTHENTICATION

Use Supabase Authentication.

Support different account types:

### Customer
Can:

- Create account
- Log in
- Manage profile
- Book rides
- View bookings
- View ride history

### Driver
Can:

- Apply to become a driver
- Complete onboarding
- Log in after approval
- View assigned rides
- Update ride status

### Admin
Can:

- View customers
- View drivers
- Approve/reject driver applications
- View bookings
- Manage pricing
- Manage service areas
- Manage vehicle categories
- View corporate enquiries
- Manage platform operations

Role-based access must be enforced using proper database security/RLS.

---

# 18. BOOKING SYSTEM

The booking system should eventually support:

- Pickup location
- Drop location
- Date
- Time
- Vehicle category
- Fare estimate
- Customer details
- Booking confirmation
- Booking status
- Driver assignment
- Ride status
- Payment status

Booking flow:

```text
Customer
   ↓
Select pickup
   ↓
Select destination
   ↓
Select date/time
   ↓
Select vehicle
   ↓
Calculate fare
   ↓
Confirm booking
   ↓
Payment
   ↓
Booking created
   ↓
Driver assigned
   ↓
Ride
   ↓
Completed
