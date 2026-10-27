# AlMajna website: setup script for Claude in Chrome

Paste one phase at a time into Claude in Chrome. Each phase ends with a
report to send back to the Claude Code session that builds the site.

Values used throughout:

| Name | Value |
| --- | --- |
| GitHub repository | `yehiamamdouh/almajna-website` (private) |
| Production branch | `main` |
| Cloudflare Pages project | `almajna` |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Live domain | `almajnaadvisors.com` (and `www.almajnaadvisors.com`) |
| Contact form recipient | `info@almajna.com` |

---

## Phase 1: repository and test deployment

```
You are helping me set up hosting for the AlMajna Advisors website. Work only in
new tabs. Stop and ask me before any step that needs a login, a payment method,
or anything not listed here. Never paste a token or password anywhere other
than the exact field named in these steps.

1. GitHub: open https://github.com/new
   - Owner: yehiamamdouh. Repository name: almajna-website
   - Visibility: Private. Do NOT add a README, .gitignore or license.
   - Create the repository, then tell me it exists. STOP here and wait until I
     say the code has been pushed (a Claude Code session pushes it).

2. After I confirm the push: open https://dash.cloudflare.com and choose the
   account I tell you to use.
   - Go to Workers & Pages -> Create -> Pages -> Connect to Git.
   - If asked, install/authorize the Cloudflare GitHub app for the repository
     yehiamamdouh/almajna-website only (not all repositories).
   - Select the repository almajna-website.
   - Project name: almajna. Production branch: main.
   - Framework preset: None. Build command: npm run build.
     Build output directory: dist. Root directory: leave empty.
   - Environment variables (Production and Preview): NODE_VERSION = 20
   - Save and Deploy. Wait for the build to finish.

3. Report back:
   - the build result (success / failure; if it failed, copy the last 40 lines of the build log),
   - the project address (https://almajna.pages.dev or similar),
   - whether the account already has the zone almajnaadvisors.com under
     "Websites" (yes/no). Do not add or change anything there.
```

---

## Phase 2: contact form email (Resend)

```
Continue the AlMajna setup. Same rules: stop and ask before logins or payments,
and only paste secrets into the exact field named.

1. Open https://resend.com and sign up / log in (ask me for the account to use).
2. Domains -> Add Domain -> almajnaadvisors.com, region closest to Egypt (eu-west-1 is fine).
3. Resend shows DNS records (MX/TXT for sending, DKIM TXT, optional DMARC).
   - If the Cloudflare account has the zone almajnaadvisors.com: open it in a
     second tab -> DNS -> Records and add each record exactly as Resend shows
     it (type, name, value, priority). For TXT/CNAME records set Proxy status to
     "DNS only". Do NOT delete or edit any existing record, especially MX records.
   - If the zone is not in Cloudflare: STOP and tell me; I will add the records
     where the domain's DNS is hosted today.
4. Back in Resend, click Verify DNS Records and wait until the domain shows Verified
   (it can take a few minutes; refresh).
5. API Keys -> Create API Key. Name: almajna-website. Permission: Sending access.
   Domain: almajnaadvisors.com. Copy the key (shown once).
6. Cloudflare -> Workers & Pages -> almajna -> Settings -> Variables and Secrets ->
   Production. Add:
   - RESEND_API_KEY  type Secret  value: the key from step 5
   - CONTACT_TO      type Text    value: info@almajna.com
   - CONTACT_FROM    type Text    value: AlMajna Website <website@almajnaadvisors.com>
   Save.
7. Deployments -> on the latest production deployment choose "Retry deployment"
   (so the variables are picked up). Wait for success.
8. Open https://almajna.pages.dev/contact/ (use the real project address), fill
   the form with Name: Setup Test, Email: my email, Message: "Test from setup",
   tick the privacy box and send. Report the message shown under the form.
   Then do the same on /ar/contactus-ar/.
9. Report back: Resend domain status, whether both forms showed a success message.
```

---

## Phase 3: admin panel login (run when the Claude Code session says the admin panel is ready)

```
Continue the AlMajna setup. Same rules as before.

A. GitHub token for the admin panel
1. Open https://github.com/settings/personal-access-tokens/new (fine-grained token).
   - Name: almajna-admin. Expiration: 1 year (or the longest I approve).
   - Resource owner: yehiamamdouh. Repository access: Only select repositories ->
     almajna-website.
   - Repository permissions: Contents = Read and write. Metadata = Read-only
     (set automatically). Nothing else.
   - Generate token and copy it (shown once).
2. Cloudflare -> Workers & Pages -> almajna -> Settings -> Variables and Secrets ->
   Production. Add:
   - GITHUB_TOKEN   type Secret  value: the token from step 1
   - GITHUB_REPO    type Text    value: yehiamamdouh/almajna-website
   - GITHUB_BRANCH  type Text    value: main

B. Login with Cloudflare Access (email code, no passwords)
3. Cloudflare dashboard -> Zero Trust. If this is the first time, choose a team
   name (suggest: almajna) and the Free plan. If it asks for a payment method
   for the Free plan, STOP and ask me.
4. Zero Trust -> Settings -> Authentication -> Login methods: make sure
   "One-time PIN" is added.
5. Zero Trust -> Access -> Applications -> Add an application -> Self-hosted.
   - Application name: AlMajna admin
   - Session duration: 24 hours
   - Add these public hostnames / paths (one row each):
       almajna.pages.dev  path: admin
       almajna.pages.dev  path: api/admin
     (later, after Phase 4, add the same two paths for almajnaadvisors.com)
   - Identity providers: One-time PIN only. Turn on "Instant Auth" if offered.
   - Policy: name "Editors", Action Allow, Include -> Emails -> the editor
     emails I give you.
   - Save.
6. Open the application again -> Overview / Basic information: copy the
   "Application Audience (AUD) Tag". Note the team domain shown in
   Zero Trust -> Settings -> Custom pages (e.g. almajna.cloudflareaccess.com).
7. Pages project -> Variables and Secrets -> Production. Add:
   - ACCESS_AUD          type Text  value: the AUD tag
   - ACCESS_TEAM_DOMAIN  type Text  value: e.g. almajna.cloudflareaccess.com
   Retry the latest deployment and wait for success.
8. Open https://almajna.pages.dev/admin/ in a private window: you should get the
   Cloudflare Access email-code page. Report what you see. Do not try to log in
   with an email that is not mine.
9. Report back: token created (yes/no, expiry date), Access application created,
   the AUD tag and team domain values you saved.
```

---

## Phase 4: switch the live domain (only after I approve the test site)

```
Continue the AlMajna setup. Same rules as before. This phase changes the live
website, so confirm with me before step 2.

1. Cloudflare -> Workers & Pages -> almajna -> Custom domains -> Set up a custom
   domain -> almajnaadvisors.com. Then again for www.almajnaadvisors.com.
2. If the zone almajnaadvisors.com is in this Cloudflare account, Cloudflare
   offers to create the DNS records: show me the change (old record -> new
   record) and wait for my OK before confirming.
   If the zone is not in this account, STOP and tell me the records Cloudflare
   asks for; the domain's nameservers or records must be changed where the
   domain is registered.
3. Zero Trust -> Access -> Applications -> AlMajna admin -> add the hostnames
   almajnaadvisors.com path admin and almajnaadvisors.com path api/admin. Save.
4. Wait until both custom domains show "Active", then open
   https://almajnaadvisors.com/ , /ar/home-ar/ , /contact/ and /admin/ and report
   whether each loads (the admin should ask for the email code).
```
