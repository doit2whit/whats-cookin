# What's Cookin 🍳

A dinner tracking web application for you and your partner to log meals, rate them, and generate shopping lists.

## Features

- 📅 **Calendar View** - Track dinners by day with month/week views
- 🍽️ **Meal Management** - Log homemade meals, restaurant visits, and dinners at friends' houses
- ⭐ **Ratings** - Rate meals separately (Ian's rating & Hanna's rating)
- 🛒 **Shopping Lists** - Generate combined ingredient lists from 1-4 meals
- 🔍 **All Dinners** - Browse and filter your complete meal history
- 🔐 **Google Sign-In** - Secure access restricted to authorized users

## Tech Stack

- **Frontend**: React 18 + TypeScript + Vite
- **Styling**: Tailwind CSS
- **Hosting**: Vercel
- **Database**: Google Sheets
- **Auth**: Google OAuth 2.0

## Setup Instructions

### 1. Clone and Install

```bash
git clone <your-repo>
cd whats-cookin
npm install
```

### 2. Set Up Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project called "Whats Cookin"
3. Enable the **Google Sheets API**
4. Enable **Google Identity Services**

### 3. Create Service Account (for Sheets API)

1. Go to **APIs & Services** → **Credentials**
2. Click **Create Credentials** → **Service Account**
3. Name it "whats-cookin-backend"
4. Go to the **Keys** tab → **Add Key** → **Create new key** → **JSON**
5. Save the downloaded file securely
6. Note the service account email (ends with `@...iam.gserviceaccount.com`)

### 4. Set Up OAuth (for user login)

1. Go to **APIs & Services** → **OAuth consent screen**
2. Configure with:
   - App name: What's Cookin
   - User support email: your email
   - Audience: External
3. Add test users (your and your partner's Google emails)
4. Go to **Credentials** → **Create Credentials** → **OAuth client ID**
5. Choose **Web application**
6. Add authorized redirect URIs:
   - `http://localhost:5173/api/auth/callback` (local dev)
   - `https://your-app.vercel.app/api/auth/callback` (production)
7. Copy the Client ID and Client Secret

### 5. Create Google Sheet Database

1. Create a new Google Spreadsheet
2. Name it "What's Cookin Database"
3. Create these 8 sheets (tabs):

| Sheet Name | Headers (Row 1) |
|------------|-----------------|
| AllowedUsers | email, name, role, created_at |
| Meals | id, name, cuisine_type, chef, is_leftovers, is_favorite, is_quick, notes, ian_rating, hanna_rating, meal_type, restaurant_name, friend_name, created_at, last_used, use_count |
| Ingredients | id, name, display_name, store_section, default_unit, created_at, last_used |
| MealIngredients | id, meal_id, ingredient_id, quantity, unit, notes |
| CalendarEntries | id, date, meal_id, slot, created_at, created_by |
| ShoppingLists | id, name, meal_ids, created_at, expires_at, created_by |
| ShoppingListItems | id, list_id, ingredient_id, combined_quantity, store_section, is_checked, display_order |
| CuisineTags | id, name, use_count |

4. Share the spreadsheet with your service account email (Editor access)
5. Add your users to AllowedUsers:
   ```
   your@email.com | Your Name | admin | 2024-01-01T00:00:00Z
   partner@email.com | Partner Name | admin | 2024-01-01T00:00:00Z
   ```

### 6. Configure Environment Variables

Copy `.env.example` to `.env.local` and fill in:

```env
GOOGLE_SERVICE_ACCOUNT_EMAIL=your-service@project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
GOOGLE_SPREADSHEET_ID=your-spreadsheet-id-from-url

VITE_GOOGLE_CLIENT_ID=your-oauth-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-oauth-client-secret

JWT_SECRET=generate-a-random-32-char-string
```

### 7. Run Locally

```bash
npm run dev
```

Visit `http://localhost:5173`

### 8. Deploy to Vercel

1. Push to GitHub
2. Import to Vercel
3. Add all environment variables in Vercel dashboard
4. Update OAuth redirect URI in Google Cloud Console with your Vercel URL

## Project Structure

```
whats-cookin/
├── api/                  # Vercel serverless functions
│   ├── auth/            # Authentication endpoints
│   ├── meals/           # Meal CRUD + autocomplete
│   ├── calendar/        # Calendar entries
│   ├── ingredients/     # Ingredient autocomplete
│   ├── shopping-lists/  # Shopping list generation
│   └── lib/             # Shared utilities (sheets, auth)
├── src/
│   ├── components/      # React components
│   ├── hooks/           # Custom React hooks
│   ├── pages/           # Page components
│   ├── types/           # TypeScript types
│   └── styles/          # Global CSS
└── public/              # Static assets
```

## Color Palette

The app uses an earth-tone palette:
- **Primary**: Sage green (#22c55e)
- **Background**: Warm white (#fafaf9)
- **Text**: Charcoal (#292524)
- **Accent**: Slate blue (#0ea5e9)
- **Restaurant**: Amber (#f59e0b)
- **Friends**: Soft purple (#8b5cf6)
- **Favorite**: Coral red (#ef4444)
- **Quick**: Teal (#06b6d4)

## License

Private - For personal use only
