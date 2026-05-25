# Gomoku UI Design System

This document turns the generated page mockups into a route-by-route design system.
The main correction is intentional: every reference image describes one page only.
Do not combine page responsibilities because a mockup shows similar visual language.

## Reference Images

| Route intent        | Reference                                            |
| ------------------- | ---------------------------------------------------- |
| Home dashboard      | [01-home-dashboard.png](./01-home-dashboard.png)     |
| Active game / vs AI | [02-active-game.png](./02-active-game.png)           |
| vs Human lobby      | [03-vs-human-lobby.png](./03-vs-human-lobby.png)     |
| Leaderboard         | [04-leaderboard.png](./04-leaderboard.png)           |
| Friends             | [05-friends.png](./05-friends.png)                   |
| Messages            | [06-messages.png](./06-messages.png)                 |
| Private profile     | [07-private-profile.png](./07-private-profile.png)   |
| Public profile      | [08-public-profile.png](./08-public-profile.png)     |
| Account settings    | [09-account-settings.png](./09-account-settings.png) |
| Login               | [10-login.png](./10-login.png)                       |
| Sign up             | [11-signup.png](./11-signup.png)                     |
| Edit profile        | [12-edit-profile.png](./12-edit-profile.png)         |
| Privacy policy      | [13-privacy-policy.png](./13-privacy-policy.png)     |
| Terms of service    | [14-terms-of-service.png](./14-terms-of-service.png) |

## Product Direction

The app should feel like a premium competitive Gomoku room: quiet, precise, and ranked.
The mood is dark lacquer, warm wood, brass hardware, and mint-lit status indicators.
It should not feel like a marketing site, generic SaaS dashboard, or arcade toy.

Design principles:

- One route, one job. Home is a command center, not a collage of game/lobby pages.
- Dense but legible. Most pages are operational tools for repeated use.
- Opaque surfaces. Menus, selects, cards, and popovers must never be translucent enough to show text through them.
- Brass defines structure. Mint confirms live/positive state. Red is reserved for destructive, danger, or human-challenge emphasis.
- The wooden board is the product object. Use it meaningfully on game/auth/home, not as decoration everywhere.
- Desktop-first for these references. Mobile can adapt later, but the design source is 1920x1080 PC.

## Page Boundary Matrix

Use this matrix as the guardrail while rebuilding. A page may share global shell,
tokens, and primitives, but it should not borrow another page's main content job.

| Page             | Primary job            | Primary content                                                  | Excluded content                        |
| ---------------- | ---------------------- | ---------------------------------------------------------------- | --------------------------------------- |
| Home dashboard   | Choose next action     | Hero, quick actions, recent activity, compact rank snapshot      | Full game, full lobby, full leaderboard |
| Active game      | Play a match           | Board, timers, AI/opponent panel, move history                   | Home modules, room creation             |
| vs Human lobby   | Find/create room       | Create room form, room table, lobby tabs                         | Full board, profile analytics           |
| Leaderboard      | Compare ranks          | Ranked table, season summary, rank distribution                  | Friend management, chat                 |
| Friends          | Manage social graph    | Friends table, requests, suggestions, activity                   | Chat thread, leaderboard                |
| Messages         | Talk and invite        | Inbox, conversation, invite card, composer                       | Friends table, game board               |
| Private profile  | Review own progress    | Own stats, matches, achievements, season progress                | Edit/account settings                   |
| Public profile   | Inspect another player | Public stats, actions, head-to-head, report/block                | Edit controls, private settings         |
| Account settings | Manage account         | Settings nav, identity, security, language, privacy, danger zone | Legal document copy                     |
| Login            | Return to account      | Sign-in card, board artwork, recovery links                      | Signup form fields                      |
| Sign up          | Create account         | Registration form, onboarding benefits, consent links            | Login as full secondary form            |
| Edit profile     | Update public identity | Avatar editor, profile form, visibility, preview                 | Security/account settings               |
| Privacy policy   | Read privacy terms     | Legal header, summaries, TOC, document sections                  | Account settings toggles                |
| Terms of service | Read usage terms       | Legal header, summary cards, terms sections, acknowledgement     | Privacy-specific content                |

## Global Foundations

### Layout Grid

Desktop viewport target: `1920 x 1080`.

Use a persistent left sidebar on all app pages.

| Token              | Value            | Use                                              |
| ------------------ | ---------------- | ------------------------------------------------ |
| `--sidebar-width`  | `236px`          | Desktop left navigation rail                     |
| `--page-gutter`    | `24px`           | Space between sidebar/content and viewport edges |
| `--page-gap`       | `24px`           | Main column gaps                                 |
| `--panel-radius`   | `8px`            | Cards, panels, tables, dialogs                   |
| `--control-radius` | `6px`            | Buttons, inputs, tabs                            |
| `--hairline`       | `1px`            | Brass/divider borders                            |
| `--row-height`     | `56px` to `64px` | Dense table rows                                 |
| `--input-height`   | `52px`           | Forms and selects                                |
| `--button-height`  | `48px`           | Primary controls                                 |

Main content starts after the sidebar and should use a constrained full-screen canvas:

- Left edge: `sidebar width + 24px`.
- Right edge: `24px`.
- Top/bottom gutters: `22px` to `28px`.
- Main pages should fit the first desktop viewport when possible.
- Content may scroll only where the data volume naturally requires it, such as tables, messages, legal docs, and settings.

### Color Tokens

Use CSS variables so each component can share a single visual language.

```css
:root {
  --ink-950: #020504;
  --ink-925: #040b09;
  --ink-900: #06100d;
  --ink-850: #081713;
  --ink-800: #0c1b16;
  --ink-750: #12231d;

  --panel: #07120f;
  --panel-raised: #0b1814;
  --panel-solid: #08110e;
  --panel-hover: #10241c;

  --brass-300: #f1d08a;
  --brass-400: #d8ac59;
  --brass-500: #c9953a;
  --brass-700: #7a5524;

  --mint-300: #9bf5a8;
  --mint-400: #76e18a;
  --mint-500: #58c970;
  --mint-700: #246f3a;

  --red-400: #f0645b;
  --red-500: #d83c34;
  --red-700: #8f241f;

  --amber-400: #f2c24d;
  --blue-400: #67b7ff;
  --purple-400: #b78cff;

  --text: #f6f1e7;
  --text-soft: #ddd7ca;
  --muted: #aeb8ad;
  --muted-dim: #7f8a82;

  --border: rgb(216 172 89 / 32%);
  --border-soft: rgb(216 172 89 / 18%);
  --focus-ring: rgb(118 225 138 / 32%);
}
```

Guidance:

- Page backgrounds use `--ink-950` plus a subtle grid/noise layer.
- Panels use `--panel` or `--panel-raised` at full opacity.
- Borders are brass, low alpha for standard panels and stronger for selected states.
- Active navigation and selected options use mint fill with a brass side edge.
- Destructive actions use red fill or red outline only.

### Typography

Use a high-contrast serif for display headings and a neutral but polished sans for body/UI.

Recommended pairing:

- Display: `Cormorant Garamond`, `Newsreader`, or `Georgia` fallback.
- Body/UI: `Manrope`, `Avenir Next`, or system sans fallback.
- Numeric/data: inherit body with `font-variant-numeric: tabular-nums`.

Scale:

| Token        | Size             | Weight         | Use                            |
| ------------ | ---------------- | -------------- | ------------------------------ |
| `display-xl` | `56px` to `72px` | `700`          | Auth/home hero titles          |
| `display-lg` | `44px` to `56px` | `700`          | Page titles                    |
| `heading-md` | `24px` to `32px` | `700`          | Panel headings                 |
| `body`       | `15px` to `16px` | `400` to `600` | Main copy                      |
| `label`      | `11px` to `13px` | `800`          | Uppercase field/section labels |
| `table`      | `14px` to `15px` | `500` to `700` | Rows                           |

Letter spacing:

- Body and headings: `0`.
- Uppercase labels: `0.12em` to `0.18em`.
- Do not use negative letter spacing.

### Surfaces

Use a small family of surfaces, not a new card style per page.

| Component            | Shape                                                                    |
| -------------------- | ------------------------------------------------------------------------ |
| Page panel           | `8px` radius, brass border, opaque ink fill, soft inner top highlight    |
| Data table           | One outer panel, sticky-ish header feel, rows separated by `border-soft` |
| Stat card            | Compact card, icon left or top, metric large, label small                |
| Action card          | Icon, title, body, full-width CTA                                        |
| Auth card            | Larger panel with decorative divider and one strong CTA                  |
| Legal document panel | Wide reading card with section dividers and side table of contents       |

Never place a decorative card inside another decorative card unless it is a real repeated item,
such as a table row, message bubble, request row, or setting row.

### Controls

Buttons:

- Primary: mint gradient fill, dark text, strong focus ring.
- Danger: red gradient fill, white text.
- Secondary: solid ink panel, brass border, text.
- Ghost: transparent only in low-risk toolbars; hover fills with `panel-hover`.
- Icon buttons: square `40px` to `44px`, centered lucide icon, tooltip where meaning is not obvious.

Inputs/selects:

- Height `52px`, opaque `--panel-solid`.
- Border `--border-soft`; focused border mint.
- Placeholder `--muted-dim`.
- Select dropdowns and menu content must be opaque `--panel-solid`, not glass.

Tabs:

- Use segmented controls or underlined tab bars.
- Active tab uses mint text, mint underline/fill, and sometimes a brass left glow.

Tables:

- Header uppercase labels.
- Rows use large click targets.
- Ranking and status cells use icons, badges, and tabular numbers.
- Avoid row cards when a real table improves scanning.

### Common Components

These should be implemented once and reused.

- `AppShell`: sidebar plus content canvas.
- `AppSidebar`: logo, nav sections, session card, language selector, auth/user actions.
- `PageHeader`: eyebrow, icon, title, subtitle, optional action area.
- `SurfacePanel`: standard page/panel surface.
- `MetricCard`: icon, value, label, delta/progress.
- `DataTable`: table header, row, pagination, empty/preview state.
- `SegmentedTabs`: tabs with optional badges.
- `StatusBadge`: online, waiting, in-game, private, verified, live.
- `RankBadge`: dan/rating display with brass medal variants.
- `AvatarStack` and `PlayerAvatar`: portrait plus online dot.
- `GomokuBoardPreview`: noninteractive wood board preview.
- `GomokuBoardInteractive`: full board with coordinate labels and last-move marker.
- `MatchInviteCard`: compact board thumbnail, players, accept/decline.
- `SettingsRow`: icon, label, helper, trailing toggle/select/button.
- `LegalToc`: numbered table of contents and support links.

## Tailwind and shadcn Contract

The app already uses Tailwind CSS and shadcn-style primitives. Keep the system
small by mapping the visual language onto tokens instead of creating bespoke CSS
per route.

Suggested theme names:

| Token name               | Maps to          |
| ------------------------ | ---------------- |
| `background`             | `--ink-950`      |
| `foreground`             | `--text`         |
| `card`                   | `--panel`        |
| `card-foreground`        | `--text`         |
| `popover`                | `--panel-solid`  |
| `popover-foreground`     | `--text`         |
| `primary`                | `--mint-400`     |
| `primary-foreground`     | `--ink-950`      |
| `secondary`              | `--panel-raised` |
| `secondary-foreground`   | `--text-soft`    |
| `muted`                  | `--panel-hover`  |
| `muted-foreground`       | `--muted`        |
| `accent`                 | `--brass-400`    |
| `accent-foreground`      | `--ink-950`      |
| `destructive`            | `--red-500`      |
| `destructive-foreground` | `--text`         |
| `border`                 | `--border-soft`  |
| `ring`                   | `--focus-ring`   |

Implementation rules:

- shadcn `DropdownMenuContent`, `SelectContent`, `PopoverContent`, `Command`,
  and dialog surfaces must use opaque `popover`/`card` backgrounds.
- Prefer shadcn primitives for accessibility and behavior, then restyle them with
  these tokens.
- Use lucide icons for sidebar, toolbar, table actions, settings rows, and auth
  buttons.
- Keep page-specific components thin; most styling should come from shared shell,
  surface, table, form, and badge primitives.
- Preserve server/client boundaries when implementing later. Interactive widgets
  such as dropdowns, forms, game controls, and chat composer belong in client
  components; static page scaffolding can stay server-rendered.

## Sidebar System

The sidebar is the main identity anchor.

Structure:

1. Logo mark centered at top.
2. Brand text below logo.
3. Navigation groups: Play, Social, Account/More depending on route.
4. Active nav item: mint/brass highlight with icon and label.
5. Session card: ranked status, mode/rules, language selector.
6. Auth or user block at bottom.

Desktop width target: `236px`.
Sidebar content should never force horizontal overflow.

State variants:

- Anonymous: Login and Sign Up actions.
- Signed in: avatar, username, rank, online dot, logout or premium action where needed.
- Route-specific active item always visible.

## Page Design Systems

### 01 Home Dashboard

Reference: [01-home-dashboard.png](./01-home-dashboard.png)  
Routes: `/[locale]`, `/[locale]/home`

Purpose:

The home page is a command center. It gives the player a sense of the world,
their next likely action, recent activity, and a ranked snapshot.

Layout:

- Sidebar plus main two-row content.
- Top hero panel spans the full content width.
- Hero left: online badge, display title, two-line intro, stats, primary action cards.
- Hero right: large photographic/3D wooden board as the product object.
- Bottom left: recent activity list.
- Bottom right: ranked snapshot with mini leaderboard and trend.

Components:

- `HomeHero`
- `QuickStatPair`
- `ActionCard` for Train vs AI and Challenge Human
- `RecentActivityList`
- `RankedSnapshotTable`

Do not include:

- Full active game board UI.
- Full human lobby table.
- Friends/messages management.

Acceptance markers:

- H1 reads like the home concept, not a game state.
- Two primary actions are prominent.
- Ranked snapshot is a summary, not the full leaderboard page.

### 02 Active Game / vs AI

Reference: [02-active-game.png](./02-active-game.png)  
Route: `/[locale]/ai`

Purpose:

The game page is a focused playing surface with AI context and match tools.

Layout:

- Sidebar.
- Left inspector column: AI opponent, difficulty, position confidence, AI suggestion.
- Center: player header, timer, large interactive 15x15 board, bottom action bar.
- Right inspector column: match info, move history, game status.

Components:

- `GameOpponentPanel`
- `PositionConfidenceRing`
- `GameHeader`
- `GomokuBoardInteractive`
- `GameToolbar`
- `MatchInfoPanel`
- `MoveHistoryPanel`
- `GameStatusPanel`

Do not include:

- Home hero, recent activity, or ranked snapshot.
- Room creation/lobby UI.

Acceptance markers:

- Board is the visual center and largest object.
- Current turn and timer are visible above the board.
- Resign action is red, undo/restart/settings are neutral.

### 03 vs Human Lobby

Reference: [03-vs-human-lobby.png](./03-vs-human-lobby.png)  
Route: `/[locale]/human`

Purpose:

The lobby page helps players create or join human rooms quickly.

Layout:

- Sidebar.
- Page header with title and tabs: Lobby, My Room, History.
- Left panel: create-room form.
- Right panel: rooms table with room, rules, players, privacy, state, ping, join.
- Bottom information strip or pagination.

Components:

- `LobbyHeader`
- `CreateRoomForm`
- `PrivacySegment`
- `RoomsTable`
- `LobbyTabs`
- `Pagination`

Do not include:

- Full game board.
- Home dashboard summary modules.
- Leaderboard rank table.

Acceptance markers:

- Create room and join room workflows are both visible.
- Lobby table is dense and scan-friendly.
- Private rooms and public rooms are visually distinct.

### 04 Leaderboard

Reference: [04-leaderboard.png](./04-leaderboard.png)  
Route: `/[locale]/leaderboard`

Purpose:

The leaderboard page is for competitive ranking, season context, and self-placement.

Layout:

- Sidebar.
- Main wide ranked table with All Players/Friends tabs and region selector.
- Bottom current-user rank summary.
- Right column: season card, rank distribution, top players this season.

Components:

- `LeaderboardHeader`
- `LeaderboardFilters`
- `RankedTable`
- `CurrentRankSummary`
- `SeasonCard`
- `RankDistribution`
- `TopPlayersCard`

Do not include:

- Friends management actions beyond leaderboard filtering.
- Messages or public profile overlays.
- Game/lobby content.

Acceptance markers:

- Top ten rows fit in the desktop viewport.
- Rank, rating, win rate, and trend columns are easy to scan.
- Current-user row/summary is visibly distinct.

### 05 Friends

Reference: [05-friends.png](./05-friends.png)  
Route: `/[locale]/friends`

Purpose:

The friends page manages social relationships and quick challenge/message actions.

Layout:

- Sidebar.
- Main friends table with search, Add Friend, tabs, sort control.
- Right rail: pending requests, suggested rivals, recent friend activity.

Components:

- `FriendsHeader`
- `FriendSearch`
- `FriendTabs`
- `FriendsTable`
- `PendingRequestsCard`
- `SuggestedRivalsCard`
- `FriendActivityCard`

Do not include:

- Full leaderboard table.
- Chat thread interface.
- Game board or lobby.

Acceptance markers:

- Challenge, Message, and Remove actions are per-row controls.
- Pending requests have accept/decline controls.
- Online/offline state is visible without opening a profile.

### 06 Messages

Reference: [06-messages.png](./06-messages.png)  
Route: `/[locale]/messages`

Purpose:

The messages page is a two-pane chat interface with match invites.

Layout:

- Sidebar.
- Left inbox panel: search, filters, conversation list.
- Right chat panel: selected user header, chat messages, match invite card, composer.

Components:

- `ConversationList`
- `ConversationRow`
- `ChatHeader`
- `MessageBubble`
- `MatchInviteCard`
- `ChatComposer`

Do not include:

- Full friends table.
- Leaderboard table.
- Full active game board.

Acceptance markers:

- Selected conversation is highlighted.
- Incoming and outgoing messages are visually different.
- Match invite has Accept and Decline actions.

### 07 Private Profile

Reference: [07-private-profile.png](./07-private-profile.png)  
Route: `/[locale]/profile`

Purpose:

The private profile page is the signed-in player's performance and identity dashboard.

Layout:

- Sidebar.
- Top profile banner: avatar, username, details, edit profile button, rank/rating cards.
- Metric card row.
- Lower grid: recent matches, achievements, about me, season progress.

Components:

- `PrivateProfileHeader`
- `ProfileMetricCard`
- `RecentMatchesList`
- `AchievementsGrid`
- `AboutMeCard`
- `SeasonProgressCard`

Do not include:

- Account settings form fields.
- Public profile action buttons like Add Friend/Challenge.
- Chat or friends management.

Acceptance markers:

- Edit Profile is the primary page action.
- Recent matches and achievements are first-viewport content.
- Rank and rating are visually important.

### 08 Public Profile

Reference: [08-public-profile.png](./08-public-profile.png)  
Route: `/[locale]/profile/[username]`

Purpose:

The public profile page helps a user inspect another player and take social/game actions.

Layout:

- Sidebar.
- Top public profile header: Back to Leaderboard, avatar, player name, online state, rank details, bio.
- Action buttons: Add Friend, Message, Challenge, Report/Block overflow.
- Top stats strip and rating progress chart.
- Lower grid: recent matches, head-to-head, achievements.

Components:

- `PublicProfileHeader`
- `ProfileActionBar`
- `StatsStrip`
- `RatingProgressChart`
- `HeadToHeadCard`
- `PublicAchievementsList`

Do not include:

- Edit profile controls.
- Private settings.
- Inbox or friend list management.

Acceptance markers:

- Challenge action is red and prominent.
- Add Friend and Message are secondary.
- Head-to-head context is visible.

### 09 Account Settings

Reference: [09-account-settings.png](./09-account-settings.png)  
Route: `/[locale]/account`

Purpose:

The account settings page manages identity, security, language, notifications, privacy,
and destructive account actions.

Layout:

- Sidebar.
- Page title and subtitle.
- Left settings navigation panel.
- Right stacked content panels in a two-column grid.
- Full-width danger zone at bottom.

Components:

- `SettingsNav`
- `ProfileInformationPanel`
- `EmailPasswordPanel`
- `SecurityToggles`
- `LanguageRegionPanel`
- `PrivacySettingsPanel`
- `NotificationSettingsPanel`
- `DangerZone`

Do not include:

- Public profile stats.
- Game or social feed content.
- Legal document content.

Acceptance markers:

- Save Changes appears in the profile information panel.
- Toggles are readable and opaque.
- Danger Zone is clearly red and visually separated.

### 10 Login

Reference: [10-login.png](./10-login.png)  
Route: `/[locale]/login`

Purpose:

The login page is a cinematic return point, centered around signing in.

Layout:

- Sidebar.
- Full-screen board artwork on the left/main background.
- Auth card on the right with secure session badge, email/password inputs, remember/forgot row, sign in CTA, optional OAuth buttons, signup link.

Components:

- `AuthCinematicShell`
- `LoginFormCard`
- `SecureSessionBadge`
- `AuthInput`
- `OAuthButton`

Do not include:

- Signup fields.
- Dashboard modules.
- Account settings.

Acceptance markers:

- Sign in is the strongest CTA.
- Form panel is opaque and readable over the board artwork.
- The page feels spacious, not table-dense.

### 11 Sign Up

Reference: [11-signup.png](./11-signup.png)  
Route: `/[locale]/signup`

Purpose:

The signup page introduces new players and collects account credentials.

Layout:

- Sidebar.
- Left signup card with username, display name, email, password, create account button, login link, terms/privacy note.
- Right visual panel with large board artwork and three benefit cards.

Components:

- `SignupFormCard`
- `AuthInput`
- `OnboardingBenefitCard`
- `LegalConsentNote`

Do not include:

- Login form as a second full form.
- Dashboard, leaderboard, or game panels.

Acceptance markers:

- Create Account is primary mint.
- Terms and Privacy links are visible near form completion.
- Benefits support signup without competing with the form.

### 12 Edit Profile

Reference: [12-edit-profile.png](./12-edit-profile.png)  
Route: `/[locale]/profile/edit`

Purpose:

The edit profile page lets the signed-in player update public identity and visibility.

Layout:

- Sidebar.
- Header title and guidelines action.
- Left card: avatar editor and public profile preview.
- Right large form: basic information, stone preference, visibility, recent stats, bottom action bar.

Components:

- `AvatarEditor`
- `PublicProfilePreview`
- `ProfileEditForm`
- `StoneColorSelector`
- `VisibilityRadioGroup`
- `RecentStatsStrip`
- `SaveCancelDeleteBar`

Do not include:

- Account security settings.
- Private profile dashboard.
- Friends/messages content.

Acceptance markers:

- Save Changes is central and mint.
- Delete Account is red and visually separate.
- The preview updates the mental model of public profile data.

### 13 Privacy Policy

Reference: [13-privacy-policy.png](./13-privacy-policy.png)  
Route: `/[locale]/privacy`

Purpose:

The privacy page is a readable legal document with trust summaries.

Layout:

- Sidebar.
- Header with Legal eyebrow, title, last updated, short description.
- Top trust cards.
- Left table of contents.
- Main document panel with numbered sections.
- Bottom contact/support strip.

Components:

- `LegalHeader`
- `TrustSummaryCards`
- `LegalToc`
- `LegalDocumentPanel`
- `LegalContactStrip`

Do not include:

- Account settings controls.
- Dashboard/game/lobby content.

Acceptance markers:

- Reading column has generous line height.
- Table of contents remains visually distinct.
- Trust cards support the document without turning it into marketing.

### 14 Terms of Service

Reference: [14-terms-of-service.png](./14-terms-of-service.png)  
Route: `/[locale]/terms`

Purpose:

The terms page is a legal document emphasizing fair play, account rules, and enforcement.

Layout:

- Sidebar.
- Main document panel on the left/middle with title, summary cards, accordion-like sections.
- Right table of contents and related legal links.
- Footer acknowledgement card.

Components:

- `TermsHeader`
- `TermsSummaryCards`
- `TermsAccordion`
- `LegalToc`
- `RelatedLegalLinks`
- `TermsAcknowledgementCard`

Do not include:

- Privacy-specific data collection cards unless linking to Privacy Policy.
- Account settings controls.
- Game/lobby/social content.

Acceptance markers:

- Enforcement receives red warning treatment.
- Fair Play and Match Conduct use green/mint positive icons.
- Numbered sections are scannable without opening every item.

## Implementation Notes

Recommended build order:

1. Foundations: tokens, sidebar, surfaces, controls, typography.
2. Data primitives: metric cards, tables, status badges, avatar/rank badges.
3. Forms: auth inputs, settings rows, selectors, toggles.
4. Page templates: dashboard, game, table page, social split, profile analytics, auth cinematic, legal reader.
5. Route-by-route implementation using the page specs above.

Quality gates:

- Every route must pass a no-horizontal-overflow Playwright check on desktop.
- Dropdowns/selects/popovers must compute to opaque `--panel-solid`.
- The home page must not include full game, full lobby, or full leaderboard page content.
- Game, lobby, leaderboard, friends, messages, profile, settings, auth, and legal routes each own their page-specific content.
- First viewport must communicate the route's primary job within three seconds of looking at it.
