// ============================================================
// YeneQR Technical Training Manual — Repux Technologies PLC
// Comprehensive guide for non-technical team members
// ============================================================

const {
  Document, Packer, Paragraph, TextRun, Header, Footer,
  AlignmentType, HeadingLevel, PageNumber, PageBreak,
  Table, TableRow, TableCell, WidthType, BorderStyle,
  ShadingType, TableLayoutType, NumberFormat, ImageRun,
} = require("docx");
const fs = require("fs");
const path = require("path");

// ── Palette (Tech / Education) ──
const P = {
  primary: "0A1628",
  body: "1A2B40",
  secondary: "6878A0",
  accent: "389654",
  surface: "F4F8FC",
  orange: "F3631F",
  white: "FFFFFF",
};

// ── Helpers ──
function h1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 480, after: 200 },
    children: [new TextRun({ text, bold: true, size: 36, color: P.primary, font: { ascii: "Times New Roman" } })],
  });
}

function h2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 360, after: 160 },
    children: [new TextRun({ text, bold: true, size: 32, color: P.accent, font: { ascii: "Times New Roman" } })],
  });
}

function h3(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_3,
    spacing: { before: 240, after: 120 },
    children: [new TextRun({ text, bold: true, size: 30, color: P.body, font: { ascii: "Times New Roman" } })],
  });
}

function body(text) {
  return new Paragraph({
    alignment: AlignmentType.JUSTIFIED,
    spacing: { line: 360, after: 120 },
    children: [new TextRun({ text, size: 28, color: P.body, font: { ascii: "Times New Roman" } })],
  });
}

function bodyBold(label, text) {
  return new Paragraph({
    alignment: AlignmentType.JUSTIFIED,
    spacing: { line: 360, after: 120 },
    children: [
      new TextRun({ text: label, bold: true, size: 28, color: P.primary, font: { ascii: "Times New Roman" } }),
      new TextRun({ text: text, size: 28, color: P.body, font: { ascii: "Times New Roman" } }),
    ],
  });
}

function bullet(text) {
  return new Paragraph({
    spacing: { line: 360, after: 80 },
    indent: { left: 720, hanging: 360 },
    children: [
      new TextRun({ text: "\u2022  ", bold: true, size: 28, color: P.accent, font: { ascii: "Times New Roman" } }),
      new TextRun({ text, size: 28, color: P.body, font: { ascii: "Times New Roman" } }),
    ],
  });
}

function bulletBold(label, text) {
  return new Paragraph({
    spacing: { line: 360, after: 80 },
    indent: { left: 720, hanging: 360 },
    children: [
      new TextRun({ text: "\u2022  ", bold: true, size: 28, color: P.accent, font: { ascii: "Times New Roman" } }),
      new TextRun({ text: label, bold: true, size: 28, color: P.primary, font: { ascii: "Times New Roman" } }),
      new TextRun({ text: text, size: 28, color: P.body, font: { ascii: "Times New Roman" } }),
    ],
  });
}

function qa(question, answer) {
  // Return a single combined paragraph to avoid array-flattening issues
  return new Paragraph({
    spacing: { before: 200, after: 120, line: 360 },
    children: [
      new TextRun({ text: "Q: ", bold: true, size: 28, color: P.orange, font: { ascii: "Times New Roman" } }),
      new TextRun({ text: question, bold: true, size: 28, color: P.primary, font: { ascii: "Times New Roman" } }),
      new TextRun({ text: "\n", size: 28, font: { ascii: "Times New Roman" } }),
      new TextRun({ text: "A: ", bold: true, size: 28, color: P.accent, font: { ascii: "Times New Roman" } }),
      new TextRun({ text: answer, size: 28, color: P.body, font: { ascii: "Times New Roman" } }),
    ],
  });
}

function spacer() {
  return new Paragraph({ spacing: { after: 120 }, children: [] });
}

function infoBox(text) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    rows: [new TableRow({
      children: [new TableCell({
        shading: { type: ShadingType.CLEAR, fill: P.surface },
        margins: { top: 120, bottom: 120, left: 200, right: 200 },
        borders: {
          top: { style: BorderStyle.SINGLE, size: 1, color: P.accent },
          bottom: { style: BorderStyle.SINGLE, size: 1, color: P.accent },
          left: { style: BorderStyle.SINGLE, size: 6, color: P.accent },
          right: { style: BorderStyle.SINGLE, size: 1, color: P.accent },
        },
        children: [new Paragraph({
          spacing: { line: 360 },
          children: [new TextRun({ text, size: 26, color: P.body, font: { ascii: "Times New Roman" }, italics: true })],
        })],
      })],
    })],
  });
}

// ── Cover Page ──
const coverSection = {
  properties: {
    page: {
      size: { width: 11906, height: 16838 },
      margin: { top: 0, bottom: 0, left: 0, right: 0 },
    },
  },
  children: [
    // Top color block
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      layout: TableLayoutType.FIXED,
      rows: [new TableRow({
        height: { value: 4000, rule: "exact" },
        children: [new TableCell({
          shading: { type: ShadingType.CLEAR, fill: P.primary },
          margins: { top: 600, bottom: 400, left: 1200, right: 1200 },
          borders: {
            top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE },
            left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE },
          },
          children: [
            // Repux logo at top of color block
            new Paragraph({
              alignment: AlignmentType.LEFT,
              spacing: { after: 200 },
              children: [new ImageRun({
                data: fs.readFileSync(path.join(__dirname, '..', 'docs', 'screenshot', 'repux-logo.png')),
                transformation: { width: 180, height: 82 },
                type: 'png',
              })],
            }),
            new Paragraph({
              alignment: AlignmentType.LEFT,
              spacing: { after: 100 },
              children: [new TextRun({ text: "YeneQR", size: 64, color: P.white, font: { ascii: "Times New Roman" }, bold: true })],
            }),
            new Paragraph({
              alignment: AlignmentType.LEFT,
              children: [new TextRun({ text: "Technical Training Manual", size: 40, color: P.accent, font: { ascii: "Times New Roman" } })],
            }),
          ],
        })],
      })],
    }),
    // Body of cover
    new Paragraph({ spacing: { before: 600 }, children: [] }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
      children: [new TextRun({ text: "A Comprehensive Guide for the Repux Team", size: 32, color: P.body, font: { ascii: "Times New Roman" } })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 },
      children: [new TextRun({ text: "Software, Servers, Security & Everything Behind the Scenes", size: 26, color: P.secondary, font: { ascii: "Times New Roman" }, italics: true })],
    }),
    new Paragraph({ spacing: { before: 2000 }, children: [] }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 100 },
      children: [new TextRun({ text: "Prepared by Repux Technologies PLC", size: 24, color: P.secondary, font: { ascii: "Times New Roman" } })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: "repuxt@gmail.com", size: 24, color: P.accent, font: { ascii: "Times New Roman" } })],
    }),
  ],
};

// ── Body Content ──
const bodyChildren = [
  // ═══ MODULE 1: SOFTWARE BASICS ═══
  h1("Module 1: Software Basics"),
  body("This module covers the fundamental concepts of software and web applications. By the end of this section, you will understand what software is, how web applications work, and be able to explain these concepts to clients in simple terms."),
  spacer(),

  h2("1.1 What is Software?"),
  body("Software is a set of instructions that tells a computer what to do. Think of it like a recipe — the computer is the chef, and the software is the recipe that tells the chef step by step how to prepare a dish. Without software, a computer is just a box of metal and plastic that does nothing."),
  body("There are three main types of software applications:"),
  bulletBold("Desktop Applications: ", "Programs installed on a computer, like Microsoft Word or Excel. They run locally on the machine and don't need internet to work."),
  bulletBold("Web Applications: ", "Programs that run in a web browser (Chrome, Safari, Firefox). Examples include Gmail, Facebook, and YeneQR. They need internet to work but don't require installation."),
  bulletBold("Mobile Applications: ", "Apps downloaded from an app store (like Telegram or Zoom). They run on phones and tablets."),
  body("YeneQR is a web application. This means restaurant owners and their staff access it through any web browser — on a phone, tablet, or computer. No installation is needed. Customers scan a QR code with their phone camera, and the menu opens in their browser."),
  spacer(),

  h2("1.2 Frontend vs Backend — The Restaurant Analogy"),
  body("Every web application has two main parts: the frontend and the backend. The easiest way to understand this is using a restaurant analogy."),
  h3("Frontend (The Dining Room)"),
  body("The frontend is everything the user sees and interacts with. In a restaurant, this is the dining room — the tables, the menu, the decor, the waiter. In YeneQR, the frontend includes:"),
  bullet("The QR menu that customers see on their phones"),
  bullet("The admin dashboard that restaurant managers use"),
  bullet("The kitchen display that kitchen staff see"),
  bullet("Buttons, colors, images, animations — everything visual"),
  body("The frontend is built using HTML (structure), CSS (styling), and JavaScript (interactivity). These are the \"languages\" the browser understands."),
  h3("Backend (The Kitchen)"),
  body("The backend is everything that happens behind the scenes. In a restaurant, this is the kitchen — where the food is prepared, where ingredients are stored, where orders are processed. In YeneQR, the backend includes:"),
  bullet("The server that processes orders and payments"),
  bullet("The database that stores menu items, orders, and customer data"),
  bullet("The authentication system that handles logins"),
  bullet("The payment integration that talks to Telebirr, Chapa, and StarPay"),
  body("The backend is built using Node.js (a JavaScript runtime) and Next.js (a framework). It runs on a server — a computer that is always on and always connected to the internet."),
  h3("Database (The Pantry)"),
  body("The database is where all data is stored permanently. In a restaurant, this is the pantry and the filing cabinet — where ingredients are kept and where records are stored. In YeneQR, the database stores:"),
  bullet("Restaurant information (name, menu, prices, images)"),
  bullet("Orders (what was ordered, by whom, when, and the status)"),
  bullet("Customer data (phone numbers, loyalty points, order history)"),
  bullet("Staff accounts (usernames, passwords, roles, permissions)"),
  bullet("Payment records and platform fee ledger"),
  body("YeneQR uses SQLite for development (a lightweight file-based database) and PostgreSQL for production (a more powerful database that handles many concurrent users)."),
  spacer(),

  h2("1.3 What is a Stack?"),
  body("A \"stack\" is the combination of technologies used to build an application. YeneQR uses the following stack:"),
  bulletBold("Frontend: ", "React + Next.js + Tailwind CSS — builds the user interface"),
  bulletBold("Backend: ", "Node.js + Next.js API Routes — handles business logic"),
  bulletBold("Database: ", "Prisma ORM + SQLite (dev) / PostgreSQL (production) — stores data"),
  bulletBold("Real-time: ", "Socket.IO + Server-Sent Events (SSE) — instant updates"),
  bulletBold("Authentication: ", "JWT (JSON Web Tokens) — secure login sessions"),
  bulletBold("Hosting: ", "Linux VPS + PM2 + Caddy (web server) — keeps the app running"),
  body("You don't need to memorize these, but knowing the names helps when clients ask \"what technology do you use?\""),
  spacer(),

  h2("1.4 What is an API?"),
  body("An API (Application Programming Interface) is how different software systems talk to each other. Think of it as the waiter in a restaurant — the waiter takes the customer's order (request), carries it to the kitchen (backend), and brings the food back to the customer (response)."),
  body("In YeneQR, when a customer taps \"Add to Order\" on their phone:"),
  bullet("The phone sends an API request to the server: \"Add item X to order Y\""),
  bullet("The server processes the request, updates the database, and sends back a response: \"Item added successfully\""),
  bullet("The phone displays the updated cart"),
  body("APIs are also how YeneQR talks to payment providers. When a customer pays with Telebirr, YeneQR sends an API request to Telebirr's servers, and Telebirr sends back a response confirming the payment."),
  spacer(),

  h2("1.5 What is the Cloud?"),
  body("\"The cloud\" is just a marketing term for \"someone else's computer that is always on.\" When we say YeneQR is \"in the cloud,\" it means the application runs on a server in a data center, not on a computer in someone's office."),
  body("YeneQR is hosted on a VPS (Virtual Private Server) at IP address 37.60.253.124. This is a Linux server that runs 24/7. When a customer scans a QR code, their phone connects to this server, and the server sends back the menu data."),
  infoBox("Key takeaway: \"The cloud\" is not magical — it is just a computer in a data center that is always on, always connected to the internet, and managed by professionals."),

  new Paragraph({ children: [new PageBreak()] }),

  // ═══ MODULE 2: HOW YENEQR WORKS ═══
  h1("Module 2: How YeneQR Works End-to-End"),
  body("This module walks through the complete customer journey — from scanning a QR code to paying the bill — and explains what happens behind the scenes at each step. This knowledge will help you explain the system to clients and answer their questions confidently."),
  spacer(),

  h2("2.1 The QR Code Scan"),
  body("When a customer scans the QR code on their table, their phone camera reads the code and opens a URL in the browser. The URL contains an encoded payload (a piece of data) that tells the YeneQR server:"),
  bullet("Which restaurant this is (restaurant ID)"),
  bullet("Which table this is (table ID)"),
  bullet("A cryptographic signature (to prevent fake QR codes)"),
  body("The server verifies the signature, creates a customer session (a temporary login), and sends back the restaurant's menu data. The customer's phone displays the menu — this usually takes under 2 seconds on a 3G connection."),
  spacer(),

  h2("2.2 Browsing the Menu"),
  body("The menu is loaded from the database. The server sends:"),
  bullet("Categories (e.g., Breakfast, Wot, Drinks, Desserts)"),
  bullet("Menu items (name, description, price, image, dietary tags)"),
  bullet("Modifier groups (e.g., cooking level for Kitfo: raw, medium, well-done)"),
  bullet("Active promotions (e.g., Happy Hour discounts)"),
  body("The menu is cached on the customer's phone, so even if the connection drops briefly, they can still browse. The menu supports multiple languages (English, Amharic, and others) — the customer can switch languages from the hamburger menu."),
  spacer(),

  h2("2.3 Placing an Order"),
  body("When the customer taps \"Add to Order,\" the phone sends an API request to the server. The server:"),
  bullet("Validates the items (are they still available? is the price correct?)"),
  bullet("Applies any active promotions or discounts"),
  bullet("Calculates the total (subtotal + tax + service charge + tip - discounts)"),
  bullet("Creates an order in the database with status \"pending\""),
  bullet("Emits a real-time event to the kitchen display and waiter's phone"),
  body("The kitchen sees the new order instantly — no need to refresh the page. This is done using WebSockets, a technology that keeps a persistent connection open between the server and the kitchen device, so updates appear immediately."),
  spacer(),

  h2("2.4 Order Flow Through the Kitchen"),
  body("Once an order is placed, it flows through these statuses:"),
  bulletBold("Pending: ", "Order received, waiting for kitchen to accept"),
  bulletBold("Preparing: ", "Kitchen has started cooking"),
  bulletBold("Ready: ", "Food is done, waiting for waiter to pick up"),
  bulletBold("Served: ", "Waiter has delivered the food to the table"),
  bulletBold("Completed: ", "Order is done and paid for"),
  body("Each status change happens in real-time. The customer can see the status on their phone (\"Your order is being prepared\"), the kitchen sees it on their display, and the waiter sees it on their device. This eliminates the need for paper tickets and verbal communication."),
  spacer(),

  h2("2.5 Payment Flow"),
  body("YeneQR supports multiple payment methods:"),
  h3("Cash Payment"),
  body("The customer selects \"Cash\" on their phone. A notification is sent to the cashier/waiter. The staff member confirms they received the cash by tapping a button in the admin dashboard. The order is then marked as paid. A platform fee is recorded in the ledger at this point."),
  h3("Digital Payment (Telebirr, Chapa, CBE Birr)"),
  body("The customer selects a digital payment method. YeneQR creates a payment request and redirects the customer to the payment provider's checkout page. After the customer pays, the provider sends a \"webhook\" (an automated callback) to YeneQR's server confirming the payment. The server then marks the order as paid."),
  h3("StarPay"),
  body("StarPay is a more advanced payment integration. The restaurant has their own StarPay merchant account. When a customer pays, StarPay processes the payment and settles the money directly to the restaurant's bank account. YeneQR receives a webhook callback to confirm the payment."),
  spacer(),

  h2("2.6 Multi-Branch Management"),
  body("A restaurant chain can manage multiple branches from one account. Each branch has:"),
  bullet("Its own tables, QR codes, and floor plan"),
  bullet("Its own staff (waiters, kitchen, cashiers)"),
  bullet("Its own orders and kitchen display"),
  bullet("Optionally, its own menu overrides (different prices, different items)"),
  body("The owner can see aggregated analytics across all branches, or drill down into a specific branch. Staff are scoped to their branch — a waiter at Branch A cannot see orders at Branch B."),
  spacer(),

  h2("2.7 What Happens When the Internet Goes Down?"),
  body("YeneQR is a web application, so it requires internet to function. If the restaurant's internet goes down:"),
  bullet("Customers cannot scan the QR code and load the menu"),
  bullet("The admin dashboard may show stale data but cannot process new orders"),
  bullet("The kitchen display stops receiving new orders"),
  body("We recommend that restaurants have a backup internet connection (e.g., mobile data on a phone with hotspot). The app is designed to work on low bandwidth — even a slow 3G connection is sufficient."),
  infoBox("Client tip: When a client asks about offline support, explain that YeneQR is optimized for low bandwidth (works on 3G), and recommend a backup internet connection. A mobile hotspot is the simplest solution."),

  new Paragraph({ children: [new PageBreak()] }),

  // ═══ MODULE 3: SERVERS & INFRASTRUCTURE ═══
  h1("Module 3: Servers, Hosting & Infrastructure"),
  body("This module explains where YeneQR \"lives\" — the physical and virtual infrastructure that keeps the application running 24/7."),
  spacer(),

  h2("3.1 What is a Server?"),
  body("A server is simply a computer that is always on, always connected to the internet, and designed to serve requests from many users at the same time. Your laptop can process one person's work at a time. A server can handle thousands of simultaneous connections."),
  body("YeneQR runs on a VPS (Virtual Private Server) — a slice of a powerful physical computer in a data center. Our server has dedicated CPU, RAM, and storage that are not shared with other customers."),
  spacer(),

  h2("3.2 Where is YeneQR Hosted?"),
  body("YeneQR is hosted on a Linux VPS at IP address 37.60.253.124. The domain yeneqr.tech points to this IP address. When someone types yeneqr.tech in their browser, the DNS system translates the name to the IP address, and the browser connects to our server."),
  spacer(),

  h2("3.3 What is DNS?"),
  body("DNS (Domain Name System) is the phonebook of the internet. When you type yeneqr.tech, DNS translates that human-readable name into a machine-readable IP address (37.60.253.124). Without DNS, users would have to memorize IP addresses to visit websites."),
  body("DNS records include:"),
  bulletBold("A record: ", "Maps yeneqr.tech to 37.60.253.124"),
  bulletBold("CNAME record: ", "Maps www.yeneqr.tech to yeneqr.tech"),
  bulletBold("MX record: ", "Handles email routing (e.g., repuxt@gmail.com)"),
  spacer(),

  h2("3.4 What is SSL/HTTPS?"),
  body("SSL (Secure Sockets Layer) is the technology that encrypts data between the user's browser and the server. You've seen it as the padlock icon in the browser's address bar. When a website uses HTTPS (HTTP + SSL), all data sent between the browser and the server is encrypted and cannot be intercepted by attackers."),
  body("YeneQR uses HTTPS exclusively. Our SSL certificate is provided by Let's Encrypt (a free certificate authority) and is automatically renewed by Caddy (our web server). The certificate ensures:"),
  bullet("Customer data (orders, payments) is encrypted in transit"),
  bullet("Login credentials cannot be intercepted"),
  bullet("The browser shows the padlock icon, building trust with users"),
  infoBox("Client tip: When a client asks about security, mention HTTPS/SSL and the padlock. This is the most visible security feature and clients understand it immediately."),
  spacer(),

  h2("3.5 What is PM2?"),
  body("PM2 is a process manager for Node.js applications. It keeps YeneQR running 24/7. If the application crashes (due to a bug or memory issue), PM2 automatically restarts it within seconds. PM2 also:"),
  bullet("Manages multiple application instances (load balancing)"),
  bullet("Collects and rotates log files"),
  bullet("Monitors CPU and memory usage"),
  bullet("Provides a dashboard to check application health"),
  body("When we deploy updates, we run a deploy script that pulls the latest code, rebuilds the application, and restarts PM2 — all without downtime."),
  spacer(),

  h2("3.6 Database: SQLite vs PostgreSQL"),
  body("YeneQR uses two different databases:"),
  bulletBold("SQLite (development): ", "A lightweight, file-based database. The entire database is a single file (custom.db). It is perfect for development and testing because it requires no setup. However, it only supports one writer at a time, so it doesn't scale to many concurrent users."),
  bulletBold("PostgreSQL (production): ", "A powerful, enterprise-grade database that handles thousands of concurrent connections. It is the industry standard for web applications. Production YeneQR runs on PostgreSQL."),
  body("We use Prisma ORM to interact with the database. Prisma is a tool that lets us write database queries in TypeScript (a programming language) instead of raw SQL. This makes the code safer and easier to maintain."),
  spacer(),

  h2("3.7 Backups and Uptime"),
  body("Backups are critical. If the server crashes or data is corrupted, backups allow us to restore the system. Currently, we take:"),
  bullet("Database backups: The database file is backed up regularly"),
  bullet("Code backups: All code is stored on GitHub (version control)"),
  bullet("Configuration backups: Server configuration is documented in deploy scripts"),
  body("Uptime is the percentage of time the application is available. \"99.9% uptime\" means the application is down for no more than 8.76 hours per year. YeneQR aims for 99.5%+ uptime. The main causes of downtime are:"),
  bullet("Server maintenance (planned, usually < 5 minutes)"),
  bullet("Application updates (planned, usually < 2 minutes)"),
  bullet("Network issues at the data center (rare)"),
  bullet("Application bugs that crash the process (auto-restarted by PM2)"),
  spacer(),

  h2("3.8 What is SSH?"),
  body("SSH (Secure Shell) is how we remotely access the server's command line. It's like using the server's keyboard from our own computer, over an encrypted connection. Only authorized developers have SSH access to the server. The SSH connection uses key-based authentication (more secure than passwords) and is protected by a firewall that only allows connections from known IP addresses."),
  body("SSH is used for:"),
  bullet("Deploying updates (running the deploy script)"),
  bullet("Checking server health (CPU, memory, disk space)"),
  bullet("Viewing application logs (error messages, request logs)"),
  bullet("Database maintenance (backups, migrations)"),
  bullet("Restarting services (PM2, Caddy, database)"),
  spacer(),

  h2("3.9 Server Monitoring"),
  body("We monitor the server's health using:"),
  bulletBold("PM2 Dashboard: ", "Shows application status, memory usage, uptime, and restart count. Accessible via SSH."),
  bulletBold("Log files: ", "The application writes logs (errors, warnings, info) that we can review. Logs are rotated (old logs are compressed and archived) to prevent disk space issues."),
  bulletBold("Caddy logs: ", "The web server logs every HTTP request — useful for diagnosing slow responses or errors."),
  bulletBold("Manual checks: ", "Periodically visiting yeneqr.tech to verify the app loads correctly. Setting up automated monitoring (e.g., UptimeRobot) to alert us if the server goes down."),
  spacer(),

  h2("3.10 Disaster Recovery"),
  body("If the server is completely destroyed (hardware failure, data center fire, etc.):"),
  bulletBold("Code: ", "All code is on GitHub — safe and version-controlled. We can deploy to a new server within 1-2 hours."),
  bulletBold("Database: ", "Database backups are taken regularly. The latest backup can be restored on a new server. Data loss is limited to the time since the last backup (hours, not days)."),
  bulletBold("DNS: ", "DNS records point yeneqr.tech to the server IP. If we get a new server, we update the DNS to point to the new IP. DNS propagation takes 5-30 minutes."),
  bulletBold("SSL: ", "Caddy automatically provisions a new SSL certificate on the new server."),
  body("Total recovery time: 1-3 hours from a complete server failure. This is why backups are critical — without them, all restaurant data would be lost."),
  infoBox("Client tip: If a client asks about disaster recovery, say: \"We take regular database backups and store all code on GitHub. In the worst case, we can deploy to a new server within 2-3 hours with minimal data loss.\""),
  spacer(),

  h2("3.11 What is a CDN?"),
  body("CDN (Content Delivery Network) is a network of servers around the world that serve static content (images, CSS, JavaScript) from locations closer to the user. Instead of every user in Ethiopia downloading images from a server in Europe, a CDN would have copies in Africa, making loading faster."),
  body("YeneQR currently does not use a CDN (most users are in Ethiopia, close to our server). If we expand to multiple countries, a CDN would improve loading speed for distant users. For now, the app is fast enough without one due to optimization (compressed images, cached menu data, minimal page weight)."),

  new Paragraph({ children: [new PageBreak()] }),

  // ═══ MODULE 4: SECURITY ═══
  h1("Module 4: Security"),
  body("Security is a top priority for YeneQR. Restaurant owners trust us with their business data and their customers' information. This module explains the security measures we have in place."),
  spacer(),

  h2("4.1 Authentication — How Login Works"),
  body("When a user logs in to YeneQR (admin, waiter, kitchen staff), the system:"),
  bullet("Checks the email and password against the database"),
  bullet("The password is not stored in plain text — it is \"hashed\" (one-way encrypted)"),
  bullet("If the credentials match, the server creates a JWT (JSON Web Token) — a digital pass that proves the user is logged in"),
  bullet("The JWT is sent to the user's browser and stored as a cookie"),
  bullet("Every subsequent API request includes this token, and the server verifies it"),
  body("JWT tokens expire after a set period (usually 24 hours). After expiry, the user must log in again. This prevents someone from stealing a token and using it forever."),
  spacer(),

  h2("4.2 Password Hashing"),
  body("We never store plain-text passwords. When a user creates an account, their password is run through a mathematical function (bcrypt) that turns it into an unrecognizable string. This is called \"hashing.\""),
  body("For example, the password \"admin123\" becomes something like: $2b$12$N9qo8uLOickgx2ZMRZoMy... (a long, unrecognizable string). Even if someone steals the database, they cannot reverse the hash back to the original password."),
  spacer(),

  h2("4.3 Two-Factor Authentication (2FA)"),
  body("YeneQR supports 2FA for admin accounts. When 2FA is enabled, the user must enter a 6-digit code from an authenticator app (like Google Authenticator) in addition to their password. This means even if someone steals the password, they cannot log in without the 2FA code."),
  spacer(),

  h2("4.4 Data Privacy"),
  body("YeneQR collects and stores the following data:"),
  bulletBold("Restaurant data: ", "Name, address, menu, prices, images, staff accounts"),
  bulletBold("Order data: ", "Items ordered, timestamps, table numbers, payment methods"),
  bulletBold("Customer data: ", "Phone number (optional), name (optional), loyalty points, order history"),
  bulletBold("Payment data: ", "Payment method, amount, status — but NOT credit card numbers"),
  body("We do NOT store credit card numbers, CVV codes, or any sensitive payment details. All payments are processed by the payment provider (Telebirr, Chapa, StarPay). We only store the payment status and reference number."),
  spacer(),

  h2("4.6 Firewall and Rate Limiting"),
  body("The server is protected by a firewall that only allows traffic on specific ports (80 for HTTP, 443 for HTTPS, 22 for SSH). All other ports are blocked."),
  body("Rate limiting prevents brute-force attacks. For example:"),
  bullet("Login attempts: Maximum 5 attempts per 15 minutes per IP address"),
  bullet("API requests: Maximum 100 requests per minute per user"),
  bullet("QR code scanning: Maximum 20 scans per minute per IP"),
  body("If someone tries to guess passwords by making thousands of login attempts, the rate limiter blocks them after 5 tries."),
  spacer(),

  h2("4.7 DDoS Attacks"),
  body("DDoS (Distributed Denial of Service) is an attack where an attacker uses many computers (often thousands, infected with malware) to flood a server with so many requests that the server becomes overwhelmed and stops responding. It is like thousands of fake customers walking into a restaurant at the same time — the staff can't serve real customers because they're overwhelmed."),
  body("YeneQR is protected against DDoS by:"),
  bullet("Rate limiting (blocks excessive requests from a single IP)"),
  bullet("Caddy web server (has built-in connection limits)"),
  bullet("The data center's network infrastructure (filters large-scale attacks)"),
  body("If a DDoS attack happens, the server may slow down temporarily but will not crash. The attack will eventually stop, and normal service resumes."),
  spacer(),

  h2("4.8 Phishing & Social Engineering"),
  body("Phishing is when attackers pretend to be a trusted entity (like YeneQR, a bank, or a government agency) to trick users into revealing passwords or clicking malicious links. For example, an email that looks like it's from YeneQR saying \"Your account has been suspended, click here to reactivate\" — but the link goes to a fake website that steals the password."),
  body("The Repux team should:"),
  bullet("Never click links in suspicious emails — always type yeneqr.tech directly in the browser"),
  bullet("Never share passwords with anyone — YeneQR staff will never ask for your password"),
  bullet("Verify any \"urgent\" account messages by logging in directly to the admin dashboard"),
  bullet("Report suspicious emails or messages to repuxt@gmail.com"),
  body("Social engineering is a broader term — attackers may call on the phone pretending to be IT support, or visit in person pretending to be a technician. Always verify identity before sharing any information."),
  infoBox("Rule of thumb: If someone asks for your password, they are NOT from YeneQR. We never ask for passwords — ever."),
  spacer(),

  h2("4.9 Common Security Questions"),
  qa("Is my data safe?", "Yes. All data is encrypted in transit (HTTPS), passwords are hashed, servers are secured with firewalls, and we take regular backups. Only authorized staff can access your data."),
  qa("Can someone hack the QR code?", "No. Each QR code contains a cryptographic signature. If someone tries to create a fake QR code, the server will reject it because the signature won't match."),
  qa("What happens if a staff member leaves?", "The manager can deactivate the staff member's account immediately. They will no longer be able to log in or access any data."),
  qa("Can my competitors see my data?", "No. Each restaurant's data is completely isolated. Restaurant A cannot see Restaurant B's orders, menu, or customers. The system enforces this at the database level."),

  new Paragraph({ children: [new PageBreak()] }),

  // ═══ MODULE 5: PAYMENT INTEGRATION ═══
  h1("Module 5: Payment Integration"),
  body("This module explains how payments work in YeneQR, including the different payment methods, the flow of money, and how YeneQR makes money."),
  spacer(),

  h2("5.1 Cash Payment Flow"),
  body("Cash is the simplest payment method in YeneQR:"),
  bullet("Customer selects \"Cash\" on their phone"),
  bullet("A notification appears on the cashier/waiter's device: \"Table 8 wants to pay 450 ETB in cash\""),
  bullet("The staff member physically collects the cash from the customer"),
  bullet("The staff member taps \"Confirm\" in the admin dashboard"),
  bullet("The order is marked as paid, and a platform fee is recorded"),
  body("The platform fee is calculated on the net revenue (subtotal + service charge), excluding tips and tax. The fee rate is set per-restaurant by the YeneQR admin team."),
  spacer(),

  h2("5.2 Digital Payment Flow (Telebirr/Chapa/CBE Birr)"),
  body("Digital payments involve more steps:"),
  bullet("Customer selects a payment method (e.g., Telebirr)"),
  bullet("YeneQR creates a payment request and generates a unique reference number"),
  bullet("The customer is redirected to the payment provider's checkout page"),
  bullet("The customer enters their PIN or confirms the payment in their banking app"),
  bullet("The payment provider processes the payment"),
  bullet("The provider sends a \"webhook\" (automated callback) to YeneQR's server: \"Payment of 450 ETB confirmed\""),
  bullet("YeneQR verifies the webhook signature (to prevent fake confirmations)"),
  bullet("The order is marked as paid, and a platform fee is recorded"),
  body("This entire process takes 5-15 seconds. If the webhook doesn't arrive (e.g., network issue), YeneQR also polls the payment provider every few seconds to check the status."),
  spacer(),

  h2("5.3 StarPay Integration"),
  body("StarPay is a more advanced payment integration where the restaurant has their own StarPay merchant account. The flow:"),
  bullet("Restaurant registers with StarPay and gets a merchant ID and API secret"),
  bullet("The restaurant enters these credentials in the YeneQR admin dashboard"),
  bullet("When a customer pays, YeneQR creates a StarPay order"),
  bullet("StarPay processes the payment (USSD, card, or bank transfer)"),
  bullet("StarPay sends a webhook callback to YeneQR confirming the payment"),
  bullet("StarPay settles the money directly to the restaurant's bank account (minus StarPay's processing fee)"),
  bullet("YeneQR records the platform fee in the ledger"),
  body("StarPay is the recommended payment method for restaurants that want digital payments settled directly to their bank account."),
  spacer(),

  h2("5.4 What is a Webhook?"),
  body("A webhook is an automated message sent from one system to another when something happens. Think of it as a phone call: when the payment is confirmed, the payment provider \"calls\" YeneQR's server to say \"Payment #12345 is confirmed.\""),
  body("YeneQR listens for these webhook calls at a specific URL (e.g., yeneqr.tech/api/restaurants/.../payments/webhook/starpay). When a webhook arrives, the server:"),
  bullet("Verifies the signature (to ensure it's really from StarPay, not an attacker)"),
  bullet("Checks if the payment has already been processed (to avoid duplicates)"),
  bullet("Updates the order status to \"paid\""),
  bullet("Records the platform fee"),
  bullet("Sends a real-time notification to the kitchen and waiter"),
  spacer(),

  h2("5.5 Platform Fee Model"),
  body("YeneQR makes money through a per-transaction platform fee. The fee model is:"),
  bulletBold("Fee rate: ", "0.5% to 3% of each transaction, set per-restaurant by the YeneQR admin team"),
  bulletBold("Fee basis: ", "Charged on net revenue (subtotal + service charge), EXCLUDING tips, tax, and packaging fees"),
  bulletBold("Billing: ", "Fees are accumulated in a ledger and billed monthly via invoice"),
  bulletBold("Default rate: ", "3% for new restaurants (Basic plan)"),
  bulletBold("Negotiated rate: ", "Can be lowered for high-volume restaurants (e.g., 1% for enterprise)"),
  body("The fee rate is decoupled from the subscription plan. This means the fee rate and the monthly subscription are independent decisions — the admin can set any fee rate for any restaurant without changing their plan."),
  spacer(),

  h2("5.6 Refunds"),
  body("When a payment is refunded:"),
  bullet("The staff initiates a refund from the admin dashboard"),
  bullet("The payment provider processes the refund (for digital payments)"),
  bullet("The order status changes to \"refunded\""),
  bullet("The platform fee for that transaction is reversed (the restaurant is not charged a fee on refunded money)"),
  body("This ensures the restaurant only pays fees on completed, non-refunded transactions."),
  spacer(),

  h2("5.7 What Happens When a Payment Fails?"),
  body("If a digital payment fails (insufficient funds, network timeout, customer cancels):"),
  bullet("The order remains in \"pending\" status — it is NOT cancelled automatically"),
  bullet("The customer sees a \"Payment failed\" message with a retry option"),
  bullet("The customer can retry with the same or a different payment method"),
  bullet("If the customer's account was debited but YeneQR didn't confirm, the customer should contact their payment provider — the provider will reverse the charge within 1-3 business days"),
  bullet("Staff can also use \"Verify Payment\" in the dashboard to manually check if the payment went through"),
  body("Important: A failed payment does NOT mean the order is cancelled. The order stays open until the customer pays or staff cancel it. This prevents situations where a customer's food is already being prepared but the payment fails."),
  spacer(),

  h2("5.8 What is Settlement?"),
  body("Settlement is the process of money moving from the payment provider to the restaurant's bank account. This does NOT happen instantly:"),
  bulletBold("Cash: ", "Instant — the customer hands cash directly to the staff. No settlement needed."),
  bulletBold("Telebirr/Chapa/CBE Birr: ", "The money stays in the customer's digital wallet or the provider's system. Settlement to the restaurant's bank account depends on the provider's policy (usually 1-3 business days). YeneQR does not handle settlement — it's between the restaurant and the payment provider."),
  bulletBold("StarPay: ", "StarPay settles directly to the restaurant's bank account. Settlement time is typically T+1 (next business day) or T+2, depending on the bank."),
  body("YeneQR only records that a payment was made — we don't touch the money. The money flows directly between the customer and the payment provider / restaurant's bank."),
  infoBox("Client tip: Restaurants should ask their payment provider about settlement times. YeneQR is not involved in money movement — we only track payment status."),
  spacer(),

  h2("5.9 Partial Payments (Multi-Round)"),
  body("Customers can pay part of the bill now and the rest later. For example:"),
  bullet("Customer orders 500 ETB of food"),
  bullet("Customer pays 300 ETB via Telebirr"),
  bullet("Later, customer adds 200 ETB more items (Add Round)"),
  bullet("Customer pays the remaining 400 ETB via cash"),
  body("YeneQR tracks all payments against the order and shows the remaining balance. The platform fee is charged on each payment separately (not on the full order total at once)."),

  new Paragraph({ children: [new PageBreak()] }),

  // ═══ MODULE 6: COMMON CLIENT QUESTIONS ═══
  h1("Module 6: Common Client Questions & Answers"),
  body("This module provides ready-to-use answers for the most common questions from restaurant owners. Memorize these or keep this manual handy during client meetings."),
  spacer(),

  qa("Is my data safe?",
    "Yes. All data is encrypted in transit (HTTPS), passwords are hashed using industry-standard bcrypt, servers are secured with firewalls, and we take regular database backups. Only authorized staff can access your data. Each restaurant's data is completely isolated from others."),

  qa("What happens if the internet goes down?",
    "The QR menu requires internet to load. We recommend having a backup internet connection (e.g., mobile data hotspot). YeneQR is optimized for low bandwidth — even a slow 3G connection is sufficient. The admin dashboard has a service worker that caches some data for limited offline use."),

  qa("Can I use this on multiple devices?",
    "Yes. YeneQR is a web application — any device with a web browser can access it. Kitchen staff can use tablets, waiters can use phones, managers can use laptops. There is no installation required. Multiple staff can be logged in simultaneously."),

  qa("How fast is it?",
    "The menu loads in under 2 seconds on a 3G connection. Real-time updates (new orders reaching the kitchen) appear instantly using WebSocket technology — no page refresh needed. The app is optimized for Ethiopian network conditions."),

  qa("What if the server crashes?",
    "PM2 (our process manager) automatically restarts the application within seconds if it crashes. We monitor uptime and can deploy to a backup server within 30 minutes. Database backups are taken regularly to prevent data loss."),

  qa("Can I export my data?",
    "Yes. The admin dashboard has export features for orders, menu items, and customer data. You can export to CSV/Excel format. Your data belongs to you — we never lock you in."),

  qa("Do you store credit card information?",
    "No. All payments are processed by the payment provider (Telebirr, Chapa, StarPay). We never see or store credit card numbers, CVV codes, or any sensitive payment details."),

  qa("How do updates work?",
    "We deploy updates remotely without any downtime. New features and bug fixes appear automatically — no installation or action needed from the restaurant. Updates are typically deployed during off-peak hours to minimize any impact."),

  qa("Can it work offline?",
    "Partially. The admin dashboard caches some data. The customer menu requires internet. We recommend a backup internet connection (mobile hotspot). YeneQR is optimized for low bandwidth — even 3G is sufficient."),

  qa("What is the difference between YeneQR and a POS system?",
    "YeneQR IS a POS system — plus much more. It includes QR menus, online ordering, kitchen display system, waiter management, table management, CRM, loyalty programs, games, analytics, multi-branch management, and payment integration. It replaces 5+ separate tools."),

  qa("How much does it cost?",
    "The platform is free to use. We charge a per-transaction fee (default 3%) on completed payments. The fee is calculated on net revenue, excluding tips and tax. For high-volume restaurants, we can negotiate a lower rate. There are no upfront costs or hidden fees."),

  qa("Can I customize the menu for different branches?",
    "Yes. Each branch can have its own menu, prices, and availability. You can also create branch-specific overrides for individual items (e.g., different price for the same dish at different locations)."),

  qa("What payment methods are supported?",
    "Cash, Telebirr, Chapa, CBE Birr, and StarPay. Cash payments are confirmed by staff. Digital payments are processed by the respective provider with automatic confirmation via webhooks. StarPay provides direct bank settlement."),

  qa("Can customers pay separately (split the bill)?",
    "Yes. YeneQR supports bill splitting. Multiple customers at the same table can pay for their own items separately. The system tracks which items have been paid and shows the remaining balance."),

  qa("What languages are supported?",
    "YeneQR supports English, Amharic, and other languages. The customer can switch languages from the menu. Restaurant owners can add translations for menu items in multiple languages."),

  qa("How do QR codes work?",
    "Each table has a unique QR code printed on a sticker. When a customer scans it with their phone camera, the menu opens in their browser. The QR code contains a cryptographic signature that prevents forgery. QR codes can be static (permanent) or dynamic (changeable)."),

  qa("Can I integrate with my existing POS system?",
    "YeneQR IS a POS system. It replaces your existing POS. However, if you have a specific legacy system you need to keep, we can explore API integration on a case-by-case basis."),

  qa("What if a customer walks out without paying?",
    "For dine-in, the customer's order is tied to their table. If they leave without paying, the staff can see the unpaid order in the dashboard. For cash, staff should confirm payment only after receiving the money."),

  qa("Can I print receipts?",
    "Yes. YeneQR supports thermal printers (ESC/POS) via USB, serial, Bluetooth, and network. We also generate fiscal receipts with TIN and VAT breakdown for Ethiopian tax compliance."),

  qa("Do you support takeaway and delivery?",
    "Yes. Customers can choose dine-in, takeaway, or delivery. For delivery, you can configure delivery zones and fees. The kitchen sees the order type and prepares accordingly."),

  qa("How do I handle void items or cancelled orders?",
    "Staff can cancel individual items or entire orders from the admin dashboard. Cancelled items are removed from the kitchen display. If already paid, a refund can be issued. All cancellations are logged."),

  qa("What hardware do I need?",
    "Minimum: A phone or tablet with internet, and printed QR codes for each table. Recommended: A tablet for kitchen display, a thermal printer for receipts, and a phone for each waiter. No special hardware required."),

  qa("Can I schedule orders for later?",
    "Currently, orders are placed for immediate preparation. Scheduled orders are on our roadmap. For now, customers can call the restaurant and staff can enter orders manually."),

  qa("How do I train my staff to use it?",
    "YeneQR is designed to be intuitive. Most staff learn the basics in 10-15 minutes. The kitchen display works like a digital ticket — tap to change status. We provide this training manual and can conduct a live session."),

  qa("What makes YeneQR different from competitors?",
    "Three things: (1) Built for Ethiopia — Telebirr, Chapa, CBE Birr, Amharic, fiscal receipts, low-bandwidth. (2) All-in-one — QR menu, POS, kitchen display, CRM, loyalty, games, analytics, multi-branch. (3) Flexible pricing — fee rate negotiated per-restaurant."),

  qa("Is there a mobile app, or only web?",
    "YeneQR is a web application (PWA). It runs in any browser — no app store download needed. On phones, it can be 'added to home screen' and behaves like a native app. Works on ALL devices."),

  qa("Can I see how busy my restaurant is in real-time?",
    "Yes. The dashboard shows active tables, pending orders, kitchen load, and revenue for the day — all in real-time. You can see exactly what's happening from anywhere with internet."),

  qa("What happens to my data if I stop using YeneQR?",
    "Your data belongs to you. You can export all data to CSV/Excel at any time. If you cancel, we retain your data for 30 days, then permanently delete it upon request."),

  qa("Can multiple staff use the system at the same time?",
    "Yes. Unlimited concurrent users. Kitchen on a tablet, waiter on a phone, manager on a laptop, cashier processing payments — all simultaneously, all in real-time."),

  new Paragraph({ children: [new PageBreak()] }),

  // ═══ MODULE 7: YENEQR FEATURE CATALOG ═══
  h1("Module 7: YeneQR Feature Catalog"),
  body("This module is a complete reference of every feature YeneQR offers. Use this as a checklist when presenting to clients — make sure they know about every capability, not just the QR menu."),
  spacer(),

  h2("7.1 Dashboard & Analytics"),
  bulletBold("Live Orders Dashboard: ", "Real-time view of all orders, their status, and table assignments. Updates instantly without page refresh."),
  bulletBold("Analytics & Reports: ", "Revenue trends, best-selling items, peak hours, customer behavior insights, daily sales summaries."),
  bulletBold("Menu Engineering: ", "Scatter chart showing which items are popular vs. profitable, helping owners optimize their menu."),
  bulletBold("Z-Report: ", "Daily sales report for tax filing — total revenue, tax collected, payment method breakdown. Exportable to CSV and printable."),
  bulletBold("CRM Dashboard: ", "Customer profiles, order history, visit frequency, average spend, loyalty tier."),
  spacer(),

  h2("7.2 Menu Management"),
  bulletBold("Categories: ", "Create, edit, reorder (drag-and-drop), and manage menu categories with emojis, Amharic names, and images."),
  bulletBold("Menu Items: ", "Full CRUD for items — name, description, price, cost (for margin calculation), images, dietary tags (vegetarian, spicy, vegan, halal, gluten-free)."),
  bulletBold("Modifiers: ", "Add modifier groups (e.g., cooking level, spice level, add-ons) with optional price deltas."),
  bulletBold("Allergens: ", "Tag items with allergen information (gluten, dairy, nuts, etc.) — displayed to customers."),
  bulletBold("Menu Scheduling: ", "Schedule items to appear/disappear at certain times (e.g., breakfast menu only before 11 AM)."),
  bulletBold("Branch Overrides: ", "Set different prices or availability per branch for the same item."),
  spacer(),

  h2("7.3 Kitchen & Operations"),
  bulletBold("Kitchen Display System (KDS): ", "Digital order tickets on a screen — no paper. Shows item, table, special instructions, timer, priority."),
  bulletBold("Table & Floor Plan: ", "Visual floor plan editor — drag tables, set capacity, assign to floors/sections."),
  bulletBold("Waiter Management: ", "Assign waiters to tables, track order pickup, auto-assignment based on workload."),
  bulletBold("Staff Management: ", "Create staff accounts with role-based permissions (owner, manager, waiter, kitchen, cashier). Shift tracking and entries."),
  bulletBold("Reservations: ", "Customers can reserve tables from their phone. Staff can manage, confirm, or cancel reservations."),
  bulletBold("Waitlist: ", "When no tables are available, add customers to a digital waitlist with estimated wait time."),
  spacer(),

  h2("7.4 Customer Experience"),
  bulletBold("QR Menu: ", "Customers scan QR code to view menu, customize items, place orders, and pay — all from their phone browser."),
  bulletBold("Multi-Round Ordering: ", "Customers can add more items to an existing order (\"Add Round\") without starting a new order. Kitchen sees new items immediately."),
  bulletBold("Bill Splitting: ", "Multiple customers at the same table can pay for their own items separately. System tracks what's paid and what remains."),
  bulletBold("Games & Entertainment: ", "Wot Crush (match-3 game, 20 levels), Trivia Royale, Speed Order, Emoji Guess. Leaderboard with scores across all customers."),
  bulletBold("Loyalty Program: ", "Customers earn points per order, reach tiers (Bronze, Silver, Gold), redeem rewards. Optional phone number linking for cross-visit tracking."),
  bulletBold("Call Waiter: ", "Customer can call a waiter, request the bill, or send a custom message from their phone."),
  bulletBold("Order Status Tracking: ", "Customer sees real-time status: Pending → Preparing → Ready → Served. No need to flag down a waiter to ask \"is my food ready?\""),
  bulletBold("Promotions & Dynamic Pricing: ", "Happy hour (time-based discounts), coupons (code-based), combo offers. Auto-applied at checkout."),
  bulletBold("Takeaway & Delivery: ", "Customers can choose dine-in, takeaway, or delivery. Delivery zones and fees are configurable."),
  spacer(),

  h2("7.5 QR Code Management"),
  bulletBold("QR Generation: ", "Generate QR codes for each table from the admin dashboard. Multiple styles (classic, rounded, dots, Ethiopian, branded)."),
  bulletBold("Custom Colors: ", "Customize foreground and background colors of QR codes to match restaurant branding."),
  bulletBold("Logo Overlay: ", "Embed the restaurant's logo in the center of the QR code."),
  bulletBold("QR Types: ", "Static (permanent, never expires), Dynamic (changeable URL, 24h rolling), Temporary (expires in 4 hours for events)."),
  bulletBold("Menu Assignment: ", "Assign specific menus to specific QR codes (e.g., VIP menu for VIP tables)."),
  spacer(),

  h2("7.6 Printer & Fiscal Integration"),
  bulletBold("Thermal Printer Support: ", "Connect ESC/POS thermal printers via WebUSB, WebSerial, WebBluetooth, or Network (TCP). Prints kitchen tickets and customer receipts."),
  bulletBold("Fiscal Receipts: ", "Generate TIN/VAT-compliant fiscal receipts for Ethiopian tax regulations. Includes restaurant TIN, VAT breakdown, and receipt number."),
  bulletBold("Z-Report: ", "End-of-day sales report for tax filing. Shows total revenue, tax collected, payment method breakdown. Printable and CSV-exportable."),
  spacer(),

  h2("7.7 Payment Integration"),
  bulletBold("Cash: ", "Staff confirms cash payment. Real-time notification to cashier. Platform fee recorded."),
  bulletBold("Telebirr: ", "Integrated with Ethio Telecom's Telebirr payment system. Redirect-based checkout with webhook confirmation."),
  bulletBold("Chapa: ", "Integrated with Chapa payment gateway. Supports multiple payment methods within Chapa."),
  bulletBold("CBE Birr: ", "Integrated with Commercial Bank of Ethiopia's CBE Birr mobile payment."),
  bulletBold("StarPay: ", "Full merchant account integration. Direct bank settlement. Supports USSD, card, and bank transfer. HMAC-signed webhooks."),
  spacer(),

  h2("7.8 Multi-Branch & Localization"),
  bulletBold("Multi-Branch: ", "One owner account manages all branches. Per-branch staff, tables, menus, and analytics. Aggregated reporting across branches."),
  bulletBold("Localization: ", "Full multilingual support. English, Amharic, and other languages. Menu items can have translated names and descriptions. Customer-facing UI is translatable."),
  bulletBold("Notifications: ", "Push notifications (web push) and in-app notifications for staff. Configurable notification types (new order, payment received, reservation, etc.)."),
  bulletBold("Audit Logs: ", "Every action (create, edit, delete) is logged with user, timestamp, and details. Useful for accountability and troubleshooting."),

  new Paragraph({ children: [new PageBreak()] }),

  // ═══ MODULE 8: TROUBLESHOOTING ═══
  h1("Module 8: Troubleshooting Guide"),
  body("This module covers common issues the team may encounter and how to handle them. Always try these steps first before escalating to the development team."),
  spacer(),

  h2("8.1 Kitchen Display Not Updating"),
  body("Symptom: New orders appear on the customer's phone but not on the kitchen display."),
  body("Possible causes and solutions:"),
  bulletBold("Internet connection: ", "Check if the kitchen tablet/device has internet. Try opening a website. If offline, restart the router or switch to mobile hotspot."),
  bulletBold("Browser tab inactive: ", "Some browsers pause background tabs. Make sure the kitchen display tab is active, or use \"Always On\" display mode."),
  bulletBold("Page needs refresh: ", "Try refreshing the page (pull down or press F5). The real-time connection will reconnect automatically."),
  bulletBold("Wrong branch selected: ", "Check if the correct branch is selected in the top bar. Orders from Branch A won't show on Branch B's display."),
  spacer(),

  h2("8.2 Customer Can't See the Menu"),
  body("Symptom: Customer scans QR code but gets an error or blank page."),
  body("Possible causes and solutions:"),
  bulletBold("QR code damaged: ", "Check if the QR code sticker is scratched, wet, or dirty. If so, print a new one from the admin dashboard."),
  bulletBold("No internet: ", "Customer's phone may have no data. Ask them to check their connection."),
  bulletBold("Wrong restaurant: ", "The QR code may have been moved from another table or restaurant. Verify the QR code belongs to this table."),
  bulletBold("Server issue: ", "If yeneqr.tech is down, all customers will be affected. Check if the admin dashboard loads. If not, contact the development team immediately."),
  spacer(),

  h2("8.3 Payment Shows Pending But Customer Paid"),
  body("Symptom: Customer completed payment on Telebirr/Chapa but the order still shows \"pending\" in YeneQR."),
  body("Possible causes and solutions:"),
  bulletBold("Webhook delay: ", "The payment provider may take 10-30 seconds to send the confirmation. Wait a minute and check again."),
  bulletBold("Webhook failure: ", "The provider's callback may have failed. Use the \"Verify Payment\" button in the admin dashboard — this manually checks the payment status with the provider."),
  bulletBold("Customer closed browser too early: ", "The customer may have closed the browser before the payment was confirmed. Ask for their payment reference number and verify manually."),
  bulletBold("Duplicate payment: ", "If the customer paid twice (retry), both payments will show. Refund the duplicate from the Refunds section."),
  infoBox("Always verify with the payment provider before refunding. Never refund based solely on the customer's claim — check the reference number."),
  spacer(),

  h2("8.4 Order Went to Wrong Kitchen Station"),
  body("Symptom: An order from Branch A appeared on Branch B's kitchen display."),
  body("Possible causes and solutions:"),
  bulletBold("Staff logged into wrong branch: ", "Check the branch selector in the top bar of the admin dashboard. The staff member may have switched branches accidentally."),
  bulletBold("Table assigned to wrong branch: ", "Check the table's branch assignment in Table Management. The QR code may be linked to a table in the wrong branch."),
  bulletBold("Multi-branch confusion: ", "If the restaurant has multiple branches, ensure each branch's staff only log in to their own branch URL."),
  spacer(),

  h2("8.5 Printer Not Printing"),
  body("Symptom: Orders are placed but the thermal printer doesn't print kitchen tickets."),
  body("Possible causes and solutions:"),
  bulletBold("Printer offline: ", "Check if the printer is powered on and has paper. Check the connection (USB cable, network cable, or Bluetooth)."),
  bulletBold("Browser permission: ", "The browser needs permission to access the printer (WebUSB/WebSerial). Check browser settings and re-grant permission."),
  bulletBold("Wrong printer selected: ", "In Printer Settings (admin dashboard), verify the correct printer is selected and the connection type matches."),
  bulletBold("Network printer IP changed: ", "If using a network printer, the IP address may have changed. Reconfigure the printer IP in settings."),
  spacer(),

  h2("8.6 Staff Can't Log In"),
  body("Symptom: Staff member gets \"Invalid email or password\" error."),
  body("Possible causes and solutions:"),
  bulletBold("Wrong password: ", "Reset the password from the admin dashboard (Staff Management → Edit → Reset Password)."),
  bulletBold("Wrong restaurant URL: ", "Staff must log in from their restaurant's specific URL. Using the wrong URL will reject their credentials."),
  bulletBold("Account deactivated: ", "Check if the account is active in Staff Management. Reactivate if needed."),
  bulletBold("Rate limited: ", "If the staff member tried too many times, they may be temporarily blocked. Wait 15 minutes and try again."),
  spacer(),

  h2("8.7 Escalation Protocol"),
  body("If none of the above solutions work, escalate to the development team with the following information:"),
  bulletBold("Restaurant name and ID: ", "Which restaurant is affected?"),
  bulletBold("Branch name: ", "Which branch (if multi-branch)?"),
  bulletBold("Description of the issue: ", "What happened? What was expected?"),
  bulletBold("Steps to reproduce: ", "What actions led to the issue?"),
  bulletBold("Screenshots: ", "Take a screenshot of the error or unexpected behavior."),
  bulletBold("Time of occurrence: ", "When did the issue happen? (approximate time)"),
  bulletBold("Affected users: ", "Is it one customer, one staff member, or everyone?"),
  infoBox("Contact: repuxt@gmail.com — Include \"URGENT\" in the subject for critical issues (payment failures, server down, data loss)."),

  new Paragraph({ children: [new PageBreak()] }),

  // ═══ MODULE 9: DEPLOYMENT & UPDATES ═══
  h1("Module 9: Deployment & Updates"),
  body("This module explains how updates are deployed to YeneQR and what happens behind the scenes when we push new features or fixes."),
  spacer(),

  h2("9.1 How Updates Work"),
  body("YeneQR is updated through a deployment process (\"deploy\"). The deploy script (deploy.sh) runs on the server and:"),
  bullet("Pulls the latest code from GitHub"),
  bullet("Installs any new dependencies (npm install)"),
  bullet("Generates the Prisma client (database layer)"),
  bullet("Syncs the database schema (prisma db push)"),
  bullet("Builds the application for production (next build)"),
  bullet("Restarts the application via PM2 (zero downtime)"),
  body("The restart is seamless — PM2 restarts the process in a few seconds while the web server (Caddy) queues incoming requests. Users may experience a 1-3 second delay but no error pages. For major updates, we deploy during off-peak hours."),
  body("After deploy, we verify the app is running by checking the URL and testing key features."),
  spacer(),

  h2("9.2 Version Control (Git & GitHub)"),
  body("All YeneQR code is stored on GitHub. GitHub is like Google Drive for code — it tracks every change, who made it, and when. Benefits:"),
  bulletBold("History: ", "We can see every change ever made to the code, and roll back if needed."),
  bulletBold("Backup: ", "Even if the server is destroyed, all code is safe on GitHub."),
  bulletBold("Collaboration: ", "Multiple developers can work on the same codebase without conflicts."),
  bulletBold("Branches: ", "Developers can work on new features in a \"branch\" (a copy of the code) without affecting the live system. Only merged when ready."),
  spacer(),

  h2("9.3 How to Check if an Update Was Applied"),
  body("After a deploy, you can verify the update by:"),
  bullet("Checking the app version in the admin dashboard (if displayed)"),
  bullet("Looking for the new feature or bug fix that was deployed"),
  bullet("Checking the PM2 logs on the server (for technical staff)"),
  bullet("Asking the development team to confirm"),
  spacer(),

  h2("9.4 Ethiopian Tech Context"),
  body("As Repux Technologies PLC operates in Ethiopia, the team should be aware of the following:"),
  bulletBold("ICT Authority: ", "The Ethiopian Information Network Security Agency (INSA) and the Ministry of Innovation and Technology regulate digital services. YeneQR should comply with data protection guidelines."),
  bulletBold("Data Localization: ", "Currently, YeneQR's server is hosted outside Ethiopia. For government clients or large enterprises, we may need to host locally. This is a future consideration."),
  bulletBold("Payment Regulation: ", "The National Bank of Ethiopia regulates payment services. YeneQR integrates with licensed payment providers (Telebirr, Chapa, banks) — we do not handle money directly."),
  bulletBold("Internet Infrastructure: ", "Ethiopian internet can be unreliable. YeneQR is optimized for low bandwidth (3G). We recommend restaurants have backup internet (mobile hotspot)."),
  bulletBold("Tech Gauntlet: ", "Ethiopia is rapidly digitalizing. The team should stay informed about new payment methods, government digital initiatives, and competitor products. Knowledge of the tech landscape is a competitive advantage."),
  bulletBold("Multilingual: ", "Ethiopia has 80+ languages. YeneQR currently supports English and Amharic. Adding more languages (Oromo, Tigrinya, Somali) is a future roadmap item that can be a selling point for regional restaurants."),
  infoBox("Competitive advantage: YeneQR is built specifically for the Ethiopian market — local payment integration, Amharic support, low-bandwidth optimization, and fiscal receipt compliance. Global competitors (Toast, Square) cannot match this localization."),

  new Paragraph({ children: [new PageBreak()] }),

  // ═══ APPENDIX ═══
  h1("Appendix: Glossary of Terms"),
  body("A quick reference for technical terms used throughout this manual."),
  spacer(),

  bulletBold("API: ", "Application Programming Interface — how software systems communicate with each other"),
  bulletBold("Backend: ", "The server-side of an application — handles logic, database, and authentication"),
  bulletBold("Browser: ", "Software for viewing websites (Chrome, Safari, Firefox)"),
  bulletBold("CSS: ", "Cascading Style Sheets — controls the visual styling of a website"),
  bulletBold("Database: ", "Where data is stored permanently (like a filing cabinet)"),
  bulletBold("DNS: ", "Domain Name System — translates domain names to IP addresses (the internet's phonebook)"),
  bulletBold("Frontend: ", "The user-facing part of an application (what users see and interact with)"),
  bulletBold("HTTPS: ", "HyperText Transfer Protocol Secure — encrypted web communication (the padlock)"),
  bulletBold("JWT: ", "JSON Web Token — a digital pass that proves a user is logged in"),
  bulletBold("Node.js: ", "A runtime that allows JavaScript to run on a server"),
  bulletBold("ORM: ", "Object-Relational Mapping — a tool for interacting with databases using code (Prisma)"),
  bulletBold("PM2: ", "Process Manager 2 — keeps the application running and auto-restarts on crashes"),
  bulletBold("PostgreSQL: ", "A powerful, open-source database for production use"),
  bulletBold("PWA: ", "Progressive Web App — a web app that can work offline and be installed like a native app"),
  bulletBold("QR Code: ", "Quick Response Code — a 2D barcode that contains data (like a URL)"),
  bulletBold("Rate Limiting: ", "Restricting the number of requests a user can make in a time period (prevents abuse)"),
  bulletBold("Server: ", "A computer that is always on and serves requests from users"),
  bulletBold("SQLite: ", "A lightweight, file-based database for development"),
  bulletBold("SSL: ", "Secure Sockets Layer — the technology behind HTTPS encryption"),
  bulletBold("Stack: ", "The combination of technologies used to build an application"),
  bulletBold("VPS: ", "Virtual Private Server — a slice of a physical server with dedicated resources"),
  bulletBold("Webhook: ", "An automated message sent from one system to another when something happens"),
  bulletBold("WebSocket: ", "A technology for real-time, two-way communication between browser and server"),
  bulletBold("2FA: ", "Two-Factor Authentication — requires a second verification (like a code from an app) in addition to password"),
  bulletBold("Cache: ", "Temporary storage of data for faster access — like keeping frequently-used ingredients on the counter instead of the pantry"),
  bulletBold("CDN: ", "Content Delivery Network — servers around the world that serve content faster by being closer to the user"),
  bulletBold("DDoS: ", "Distributed Denial of Service — an attack where many computers flood a server with requests, overwhelming it"),
  bulletBold("Encryption: ", "Scrambling data so only authorized parties can read it — like writing in a secret code"),
  bulletBold("Fiscal Receipt: ", "A tax-compliant receipt that includes TIN, VAT breakdown, and sequential receipt number — required by Ethiopian tax law"),
  bulletBold("Phishing: ", "A scam where attackers pretend to be a trusted entity (like a bank) to steal passwords or money"),
  bulletBold("Settlement: ", "The process of money moving from the payment provider to the restaurant's bank account — usually takes 1-3 business days"),
  bulletBold("SSH: ", "Secure Shell — a protocol for securely accessing a remote server's command line"),
  bulletBold("Authorization: ", "What a user is allowed to do after logging in — e.g., a waiter can take orders but cannot change prices"),
  bulletBold("Z-Report: ", "End-of-day sales report showing total revenue, tax, and payment breakdown — used for tax filing"),

  spacer(),
  spacer(),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 600 },
    children: [new TextRun({ text: "Repux Technologies PLC  |  repuxt@gmail.com  |  yeneqr.tech", size: 24, color: P.secondary, font: { ascii: "Times New Roman" } })],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: "This document is confidential and for internal training use only.", size: 22, color: P.textDim || "9CA3AF", font: { ascii: "Times New Roman" }, italics: true })],
  }),
];

// ── Assemble Document ──
const doc = new Document({
  styles: {
    default: {
      document: {
        run: { font: { ascii: "Times New Roman" }, size: 28, color: P.body },
        paragraph: { spacing: { line: 360 } },
      },
    },
  },
  sections: [
    coverSection,
    {
      properties: {
        page: {
          size: { width: 11906, height: 16838 },
          margin: { top: 1440, bottom: 1440, left: 1701, right: 1417 },
          pageNumbers: { start: 1, formatType: NumberFormat.DECIMAL },
        },
      },
      headers: {
        default: new Header({
          children: [new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [new TextRun({ text: "YeneQR Technical Training Manual", size: 22, color: P.secondary, font: { ascii: "Times New Roman" }, italics: true })],
          })],
        }),
      },
      footers: {
        default: new Footer({
          children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({ text: "Repux Technologies PLC  |  Page ", size: 22, color: P.secondary, font: { ascii: "Times New Roman" } }),
              new TextRun({ children: [PageNumber.CURRENT], size: 22, color: P.secondary, font: { ascii: "Times New Roman" } }),
            ],
          })],
        }),
      },
      children: bodyChildren,
    },
  ],
});

const out = "/home/z/my-project/download/YeneQR_Technical_Training_Manual.docx";
Packer.toBuffer(doc).then((buf) => {
  fs.writeFileSync(out, buf);
  console.log("✅ Saved:", out);
}).catch(e => console.error("❌", e));
