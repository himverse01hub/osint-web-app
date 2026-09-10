# AI-Based OSINT Intelligence Platform for Haryana Police

A modern, professional web application designed to help authorised police investigators collect, organise, and analyse publicly available intelligence about suspects, persons of interest, and criminal networks.

## Features

### 1. Investigator Dashboard
- Overview of investigations
- Recent searches
- Important alerts
- Statistics on persons, accounts, entities, and relationships discovered

### 2. OSINT Search
- Search using name, phone number, email ID, username, organisation, cryptocurrency wallet
- Displays results from public websites, news, social media, forums, and databases
- Uses realistic mock data for demonstration

### 3. AI Investigation Assistant
- Chat interface for natural language queries
- Examples: "Find accounts linked to this phone number", "Show connections between these two persons"
- Returns structured, easy-to-understand results

### 4. Suspect Profile
- Comprehensive entity profiles with names, aliases, contact information, social media accounts, locations, organisations, cryptocurrency wallets
- Confidence scores and sources for each finding

### 5. Relationship / Knowledge Graph
- Interactive graph connecting people, phone numbers, emails, social accounts, organisations, locations, cryptocurrency wallets
- Click nodes to explore relationships

### 6. Dark Web Intelligence
- Simulated dark-web intelligence and leaked-data matches
- Clearly labeled as simulated/demo data
- No access to real illegal marketplaces or stolen databases

### 7. Intelligence Report
- Professional investigation reports with subject overview, key findings, associated identities, online presence, relationships, investigative leads, and sources
- Export PDF and Download Report functionality

### 8. Modern UI
- Dark blue/black police-intelligence theme
- Professional cards, tables, charts, maps, graphs, badges, and icons
- Responsive design for desktop and tablet

### 9. Security
- Login page for authorised investigators
- Role-based access UI
- Audit-log section
- Warning: "For authorised investigative use only. All searches must comply with applicable laws and policies."

### 10. Demo Data
- Populated with fictional suspects, phone numbers, emails, usernames, organisations, and relationships
- Fully functional using mock/demo data

## Pages
- Login
- Dashboard
- OSINT Search
- Investigation / Suspect Profile
- AI Assistant
- Knowledge Graph
- Dark Web Intelligence
- Intelligence Reports
- Alerts
- Audit Logs
- Settings

## Technology Stack
- React 18 + TypeScript
- Vite
- Tailwind CSS
- Lucide Icons
- Chart.js
- jspdf + html2canvas (for report export)
- React Router DOM

## Getting Started

1. Install dependencies:
```bash
npm install
```

2. Start the development server:
```bash
npm run dev
```

3. Build for production:
```bash
npm run build
```

## Neon Database Setup

1. Create a project at [Neon](https://neon.tech) and copy its pooled PostgreSQL connection string.
2. Run `db/schema.sql` in the Neon SQL Editor.
3. Add the connection string to Vercel as `DATABASE_URL` for Production, Preview, and Development.
4. Redeploy the project.
5. Verify the connection at `/api/health`. A successful response contains `"database":"connected"`.

The database foundation includes users, cases, entities, relationships, alerts, search history, and audit logs. The current UI still uses demo data for most pages; future API routes will migrate those pages to these tables incrementally.

## Demo Login Credentials
- Email: vikram.singh@haryanapolice.gov.in
- Password: (any password will work for demo)

## Important Notes
⚠️ **WARNING**: For authorised investigative use only. All searches must comply with applicable laws and policies.

🔒 **DATA DISCLAIMER**: All data in this demonstration application is simulated/mock data. No real personal data or actual OSINT sources are used.

## Folder Structure
```
src/
├── components/          # Reusable UI components
├── context/             # React context providers
├── data/                # Mock data generators
├── pages/               # Application pages
├── styles/              # CSS and Tailwind configuration
├── types/               # TypeScript type definitions
└── App.tsx              # Main application component
```

## License
This project is created for demonstration purposes for Haryana Police.