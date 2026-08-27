# 卡片盒筆記系統 — Session Handoff

> 給下一個 session 接續用。最後更新：2026-08-28（最新合併：PR #15）。
> web 版路徑：`/Volumes/2tb/project/card-note`；iOS 版路徑：`/Volumes/2tb/project/card-note-ios`（見下方「iOS 版」章節與該 repo 的 `docs/ARCHITECTURE.md`）。

## 一句話

從 Claude Design 設計稿實作的 **Zettelkasten 卡片盒筆記系統**：React + Vite + TypeScript 純前端，資料以「一卡一檔」存在 GitHub repo（透過 REST API 同步）、本機 IndexedDB 快取，支援多白板、Heptabase 匯入、手機介面。**目前可正常執行、build 通過、瀏覽器冒煙測試零 console 錯誤。**

設計來源：design MCP 專案 `a7d97c6e-deb8-42da-ad4e-44eaea4543da`，檔案 `卡片盒筆記系統.dc.html`（原稿是不可運作的 mockup，已實作成真應用）。

## 目前狀態（已完成）

- ✅ 四視圖：**白板（多白板）/ 卡片庫 / 看板 / 日記**，忠實還原設計。
- ✅ 卡片詳情面板（可編輯 標題/內文/型別/標籤、雙向連結、AI 建議連結、所在白板 chips）。
- ✅ **多白板**：`Board` 內含 `placements:[{cardId,x,y}]`，多對多（一張卡可在多個白板、各有位置）。白板切換 tabs、新增白板、新增卡片、加入既有卡片、拖曳更新位置。
- ✅ **右鍵選單（context menu）+ 手機長按**：白板（空白處/卡片/連線）、卡片庫卡片、看板卡片。操作含 編輯/變更類型/加入白板/移動到欄/從專案移除/從白板移除/刪除/在此新增卡片/加入既有卡片/重置視圖/刪除連結。
- ✅ **GitHub 同步引擎**：REST Git Data API（免 proxy）、一卡一檔、三方合併、衝突「保留兩版」、baseline 存 IndexedDB。**（見下方「尚未驗證」）**
- ✅ **Heptabase 匯入**：`All-Data.json`（whiteboard→board、cardInstance→placement、connection→link）與 Markdown zip。
- ✅ **AI 兩個 provider**：本機關鍵字/標籤（離線預設）與 **Claude API**（設定頁填 key 後啟用）。兩者都實作 search/suggestLinks/extractDiary/classify。
- ✅ IndexedDB 持久化 + 舊資料自動遷移成預設白板。
- ✅ 圖示全面改用 **lucide-react**（shadcn 的圖示庫）。響應式（桌機 rail+詳情面板 / 手機底部 tab+全螢幕 sheet）。

## 如何執行 / 驗證

```bash
cd /Volumes/2tb/project/card-note
npm install            # 首次
npm run dev            # 開發（不要留在背景，見下方陷阱）
npm run build          # tsc --noEmit && vite build（型別+建置驗證）
npm test               # vitest 單元，目前 63 passed
npm run test:e2e       # playwright，目前 7 passed（會自動起 dev server）
```

正式測試都在專案內：`tests/unit/`（序列化 round-trip、三方合併、衝突解決、gitBlobSha、tabLock、ownedPaths、inboxDraft、claudeProvider）與 `tests/e2e/`（smoke、multiTab、linkDrag）。

**兩個會浪費時間的環境陷阱**：

1. **不要把 dev server 留在背景。** playwright.config 設了 `reuseExistingServer: true`，所以 Playwright 會直接沿用 5173 上既有的 server。若那個 server 是在別的分支啟動、之後又切過分支／合併過，它的模組圖已經壞掉，結果是**整套 e2e 全滅、連 smoke 都找不到「白板」**，看起來像產品壞了。診斷方式：`lsof -ti:5173`，殺掉後重跑就正常。2026-08-25 就為此繞了一圈。
2. **Playwright 的瀏覽器執行檔會消失。** 症狀是 `browserType.launch: Executable doesn't exist at .../chromium_headless_shell-*`。跑 `npx playwright install chromium` 即可，本 session 內就遇過兩次。

## 架構關鍵（重要決策）

1. **同步用 GitHub REST API 直連瀏覽器（非 isomorphic-git、無 CORS proxy）**：已驗證 `api.github.com` 支援 CORS、fine-grained PAT 可走 Authorization header。使用者選擇「用 repo token + API」。
2. **AI 走 provider 介面層**：`src/ai/` 可替換 provider，本機（離線預設）與 Claude 各一。Claude 端用 `@anthropic-ai/sdk` + `dangerouslyAllowBrowser`、`output_config.format` structured output、cached system block，模型候選 `claude-opus-4-8`→`claude-sonnet-5`→`claude-haiku-4-5`（分類反向）。
3. **多白板（多對多）**：卡片不存座標，位置存在 board placement。
4. **只碰 app 擁有的檔案**：sync 的 `OWNED_PREFIXES = cards/ projects/ diary/ boards/ + links.ndjson + cardnote.json`；repo 內其他檔（README 等）絕不被刪或合併。
5. **`inbox/` 刻意是「外來檔案」，這是資料安全邊界不是疏漏**：iPhone 捷徑直接寫草稿進 `inbox/`，app 從不解析也不序列化它們。而 `buildChanges` 會刪除「app 擁有、但本機序列化結果裡沒有」的遠端檔案——所以把 `'inbox/'` 加進 `OWNED_PREFIXES` 會在下次同步**靜默刪光整個收件匣**。`tests/unit/ownedPaths.test.ts` 守這條線。要讓 app 顯示草稿，得先做完整的 draft 型別／store／序列化（web 與 iOS 同步改），不能只加前綴。

## 資料模型 / git 檔案格式（schemaVersion 2）

```
<repo>/
├── cardnote.json          { schemaVersion:2, app:"card-note" }
├── cards/<ulid>.md        frontmatter(id,type,title,tags,created,updated) + markdown body（無 x/y）
├── boards/<id>.json       { id, name, placements:[{cardId,x,y}] }
├── links.ndjson           已確認連結（solid），每行一條、排序；AI 建議連結不進 git
├── projects/<id>.json     { id, name, color, cols:{todo,doing,done:[cardId]} }
└── diary/<YYYY-MM-DD>.md   frontmatter(date,processed,extracted) + body

（同一個 repo 裡還有兩種 app 不擁有、也不會去動的檔案：
 inbox/<yyyy-MM-dd-HHmmss>.md  iPhone 捷徑寫入的語音／連結草稿，見 docs/INBOX.md
 reports/digest-<日期>.md      Claude routine 產出的整理報告）
```

型別定義：`src/types/index.ts`（`Card`, `Board`, `Placement`, `Link`, `Project`, `DiaryEntry`, AI 契約, Sync 契約, `ImportReport`）。

## 模組地圖（src/）

```
store/index.ts        Zustand 單一 store（所有 state + actions）；persist.ts 做 IndexedDB 鏡像 + bootstrap 遷移
types/index.ts        全型別
lib/                  tokens(色票/型別表/KANBAN_COLUMNS) derive(enrichCard/boardView/linkKey/inferType)
                      bezier ulid format base64 gitBlobSha text cardMenu(右鍵選單項建構器)
                      tabLock(Web Locks 單一作用中分頁)
serialization/        card/board/links/project/diary ↔ 檔案；index.ts 的 serializeAll/parseAll 是 git 檔案地圖邊界
sync/                 githubApi(REST client) syncEngine(狀態機/三方合併/isOwnedPath) conflict(threeWayMerge/keep-both)
                      localCache(IndexedDB) autoSync(5 秒 debounce 推送 + 60 秒前景拉取)
ai/                   index(公開 API aiSearch/aiSuggestLinks/aiExtractDiary/aiClassify) local(離線預設) claude(Claude API)
importers/heptabase/  index allData markdownZip prosemirror mapping schema
views/                WhiteboardView/(index,CardNode,LinksLayer,BoardTabs,CanvasToolbar,ZoomControls,Hint)
                      LibraryView/ KanbanView/(index,KanbanCardItem) DiaryView/
components/
  layout/             AppShell TopBar LeftRail BottomTabBar DetailHost
  panels/             CardDetailContent AiSearchOverlay AiSuggestionsContent SyncStatusContent
                      SettingsDialog ImportDialog ConflictResolver NewProjectModal AddToBoardModal
  common/             icons(lucide 包裝) ContextMenu CardTypeBadge Modal Sheet
hooks/                useMediaQuery useKeyboard useLongPress
```

store 重要 actions：卡片 `addCard/updateCard/deleteCard`；白板 `selectBoard/createBoard/renameBoard/deleteBoard/addCardToBoard/addCardsToBoard/removeCardFromBoard/moveCardOnBoard/createCardOnBoard/openAddToBoard/migrateDefaultBoard`；連結 `addLink/removeLink/acceptLink/dismissLink/setAiSuggestions`；看板 `moveKanbanCard/removeCardFromProject/createProject`；日記 `addDiaryEntry/applyDiaryExtraction`；同步狀態 `setRepo/setPat/setSyncStatus/setCommits/setConflicts`；生命週期 `hydrate/mergeImport/getData`。

同步引擎入口（`src/sync/syncEngine.ts`）：`verifyRepo` / `connectAndSync` / `syncNow` / `resolveConflictsAndSync`。設定頁 `SettingsDialog` 呼叫。

## 尚未驗證 / 待辦 / 下一步

### A. 卡在使用者身上（需要他的裝置或憑證，agent 無法代勞）

這四件都已經把能做的部分做完了，只差本人操作一次：

1. **兩個 iPhone 捷徑還沒建**：語音筆記與分享連結，逐步驟見 `docs/INBOX.md`。GitHub API 的請求形狀已對 `card-note-sync-test` 實測過（201、往返逐字節相同、測試檔已清），所以文件裡的指令是可信的；沒驗的是捷徑 App 那一側的動作名稱與行為。
2. **routine 的收件匣整理 prompt 還沒貼進去**：prompt 已寫好在 `docs/INBOX.md` 最後一節，要貼到 trigger `trig_013kQVPKcbXZUcDLCQrA7arp`。在捷徑跑通、`inbox/` 真的有草稿之前，貼了也沒東西可整理。
3. **web 端 Claude API 從未用真實 key 呼叫過**：設定頁貼 key → 試 AI 搜尋即可驗。離線層已有 `tests/unit/claudeProvider.test.ts`（攔截 fetch 斷言請求形狀、模型 fallback、refusal、截斷處理），但那證明不了真實端點會接受。
4. **iOS 版三項真機驗證**：ClaudeProvider 真實 key、BGTask 真機喚醒、真機實際安裝使用（至今只在模擬器跑過）。

### B. 可以直接動手的下一步（不需要使用者）

- **白板排序／封存**——正式資料 repo 有 **31 個白板**，tabs 早就排不下，這是目前最有感的一項。
- **iOS 版移植白板拖曳建立連結**（web 已做，見紀錄第 11 項；純互動層，不涉序列化，不受兩端同步鐵律約束）。
- 圖片／附件處理（目前只支援 Markdown 連結與外部 URL）。
- AI 建議連結持久化選項（現在 AI 建議不進 git，重整就沒了）。
- web/iOS 模型候選序列升級（如加入 `claude-opus-5`，**必須兩端同步改**）。

### C. 已完成紀錄（每項自帶完成日期，順序非嚴格時間序）

1. ✅ **GitHub 同步 live 測試已通過（2026-07-08）**：對真實 repo `gpwork4u/card-note-sync-test` 用 app 的 syncEngine 跑完整輪：初次 push → 第二裝置 pull → 同卡雙改 → conflict → keep-both 解決 → 另一裝置拉回合併。非 app 擁有的檔案（README.md）確認原封不動。測試 harness 在 scratchpad（esbuild 打包 + 檔案版 localCache stub），必要時可重建。
2. ✅ **Claude API 已接（2026-07-08，後經 codex 六輪 review 修正、PR #2 已合併）**：`ClaudeProvider` 實作完成（structured outputs、cached system block、refusal/錯誤處理、模型 entitlement fallback opus-4-8→sonnet-5→haiku-4-5、啟用前 count_tokens 驗證 key）。**尚未用真實 API key 做過 live 呼叫測試**——在設定頁貼 key 後試 AI 搜尋即可驗證。
3. ✅ **正式測試已建（2026-07-08）**：`npm test`（vitest 單元 ×24：round-trip、三方合併、衝突解決、gitBlobSha）+ `npm run test:e2e`（playwright 冒煙：四視圖零 console error，自動起 dev server）。
4. ✅ **app 已上 GitHub 並公開部署**：`gpwork4u/card-note`（2026-08-09 轉 **public**）。**GitHub Pages 自動部署**：push main → Actions build → https://gpwork4u.github.io/card-note/ （`.github/workflows/deploy-pages.yml`）。變更走分支 + PR（見 git-commit-push 慣例）。README 已含「建立資料 repo」指引與「用 AI 自動整理筆記」章節（Claude routine / codex automation / CLI+cron 三種做法）。
5. ✅ **多裝置同步強化（2026-08-09）**：(a) 編輯後自動同步（`autoSync.ts`，5 秒 debounce）＋定時拉取（60 秒、僅前景）＋回前景即拉；(b) push 競態自動重試（non-fast-forward 422 → 重抓 head 再合併，最多 3 次）；(c) **結構化合併**——卡片欄位級（type/title/body 逐欄三方、tags 集合合併、updated 取新）、白板 placement 級（成員集合規則、雙拖同卡採本機座標），大幅消滅假衝突，真衝突（同欄位雙改、刪除 vs 編輯）仍走 ConflictResolver；(d) 新裝置連線時若本機還是未動過的種子資料且遠端已有 app 資料 → 直接採用遠端，不再把 demo 卡合併進正式 repo。測試 36/36。**iOS 版已同步移植全套（card-note-ios PR #1，18 tests）。**
6. ✅ **同步期間編輯不再被覆蓋（2026-08-12，PR #9）**：codex review iOS 版時發現的 critical 同樣存在 web——`hydrate(parseAll(merged))` 會蓋掉 await 期間的編輯。`adoptSyncResult()` 以同步開始狀態為 base 把當下編輯 rebase 到同步結果上；衝突解決路徑（base 用 `pending.ours`）一併處理。web 測試 38/38。
7. ✅ **多分頁互踩防護（2026-08-17）**：同一瀏覽器開多個分頁時，兩邊各自的記憶體 store 會對同一份 IndexedDB baseline 做三方合併而互相回退。`src/lib/tabLock.ts` 用 **Web Locks**（`card-note-primary-tab`，callback 回傳永不 resolve 的 promise 以持有到分頁關閉）選出唯一作用中分頁；其餘分頁顯示「已在另一個分頁開啟」待命畫面，**不 bootstrap、不寫 IndexedDB、不同步**，等鎖釋放後自動走同一段啟動流程接手。不支援 Web Locks 的環境退化成取得鎖（行為同以前）。同時修掉 StrictMode 下啟動 effect 跑兩次造成的重複 `startAutoSync`（重複訂閱 + 雙計時器）。測試 43 unit + 2 e2e（含雙分頁待命/接手）。**iOS 版不需要對應改動**（單一 app 實例）。
8. ✅ **語音草稿收件匣（2026-08-19）**：iPhone 捷徑（內建聽寫）→ GitHub Contents API → `inbox/<yyyy-MM-dd-HHmmss>.md`，一則一檔故不需讀後寫、也不與 routine 的 commit 競態。草稿格式為 YAML frontmatter（`created`/`source`/`processed`/`tags`）+ 內文。**設計上 `inbox/` 刻意不屬於 app**：`buildChanges` 會刪除「app 擁有但本機序列化結果沒有」的遠端檔案，把 `inbox/` 加進 `OWNED_PREFIXES` 會靜默刪光所有草稿——`tests/unit/ownedPaths.test.ts` 守這條線。API 請求形狀已對 card-note-sync-test 實測（201 建立、往返 UTF-8 中文無損、測試檔已清除）。完整設定見 `docs/INBOX.md`（原 `VOICE-INBOX.md`，已改名），含要加進 Claude routine 的標籤化 prompt。**待辦**：實際在手機上把捷徑建起來並跑通；routine prompt 尚未貼進去。
9. ✅ **分享連結進收件匣（2026-08-25）**：第二個捷徑掛在 iOS 分享表單，抓網址＋網頁標題＋一句可留空的備註，寫成 `source: link` 的草稿。**網頁標題刻意放內文 H1 而非 frontmatter**——標題常含冒號/引號/`|`/emoji，塞進 YAML 純量會直接讓 frontmatter 解不開；`url` 留在 frontmatter（agent 要拿它抓頁面）並用單引號包住。`tests/unit/inboxDraft.test.ts`（7 tests）用惡意標題／多行備註／含 `---` 的備註／網址帶單引號釘住這份樣板能被專案自己的 `parseDoc` 解開。已對 card-note-sync-test 實測往返（201、逐字節相同、js-yaml 解析出正確 url、測試檔已清除）。web 版不需要當分享目標：本站非 PWA，且 iOS Safari 不支援 Web Share Target。
10. ✅ **Claude provider 離線驗證 + 截斷 bug（2026-08-16）**：`tests/unit/claudeProvider.test.ts` 攔截 `fetch`，斷言實際送上線的請求形狀——模型名、`output_config.format`、reasoning 層帶 adaptive thinking 而 haiku 正確省略、cached system block、403/404 才換候選模型而 401 立刻失敗、建議連結的過濾規則。**抓到真 bug**：回應因 `max_tokens` 截斷時，半截 JSON 直接進 `JSON.parse`，使用者看到 `Unterminated string in JSON at position 13`；現在明確處理該 stop reason。同時把 reasoning 額度 2048 → 16000（adaptive thinking 的思考 token 與回應共用 `max_tokens`，幾百張卡時很容易先被思考吃掉再把 JSON 切一半）、分類 256 → 1024。
11. ✅ **白板拖曳建立連結（2026-08-19）**：卡片右緣（`CARD_CY` 高度，即貝茲線離開卡片的位置）有一個連結圓點，hover 時浮現、觸控裝置常駐半透明；按住拖到另一張卡放開即建立實線連結。**pointer capture 設在畫布而非圓點**——設在圓點的話後續 move/up 會 retarget 進 `CardNode`，而它的 `onPointerUp` 會 `stopPropagation` 吃掉放開事件；設在畫布可讓整段手勢留在同一個狀態機。命中測試用 `document.elementFromPoint` + `data-card-id`（卡片高度會隨內文變動，不能用固定盒模型算）。預覽線 `pointerEvents: 'none'`，否則會擋住命中測試。`addLink` 本身已處理自連/去重，且會把 AI 建議升級成實線。連線 path 加了 `data-link`（`linkKey` 正規化）與 `data-link-type` 供測試斷言。5 個 e2e（建立/預覽/去重/不誤移卡片/AI 升級）。**iOS 版尚未移植此互動**。
12. ✅ **文件與現況對齊（2026-08-19，PR #13）**：README 的「AI 功能」章節還停在「Claude 之後可接」、模型寫 `claude-sonnet-4-6`；已改寫成兩個 provider 的實際分工與正確的候選序列，並誠實註明尚未 live 驗證。專案結構表、`src/ai/index.ts` 註解、本檔的架構決策與模組地圖一併校正。

## 資料生態系（2026-08-09 之後的營運狀態）

app 本身之外，現在有一整條「資料 repo + 雲端 routine」的營運線：

1. **正式資料 repo：`gpwork4u/card-note-data`（private）**。現況：**285 張卡片**（85 張 `~/project` 本機專案盤點卡 + 200 張 Heptabase 匯入卡）、**31 個白板**（30 個 Heptabase 原始白板 + 「專案總覽」）、**1 個看板專案**「本機專案」（待開發 22／進行中 57／已完成 6）、`links.ndjson` 17 條、1 則工作日記。所有卡片經過內容導向分類（型別 tech 94/idea 79/design 20/…，每張 3-5 個標籤）。使用者明確要求：**不要重建/合併 Heptabase 白板，分類做好即可**。
2. **Claude routine「card-note 筆記整理助手」**（trigger `trig_013kQVPKcbXZUcDLCQrA7arp`，每 6 小時，sonnet-5，管理頁 https://claude.ai/code/routines/trig_013kQVPKcbXZUcDLCQrA7arp ）。行為：讀 card-note-data → 直接 commit `reports/digest-<日期>.md` 到 main；連結建議/日記擷取走 PR。**已驗證整條路**：產出兩份報告、開出 PR #1（8 組連結建議，人工逐一核實後於 2026-08-09 合併，links 9→17）。
3. **Heptabase 原始備份**：`/Users/gpwang/Documents/heptabase/Heptabase-Data-Backup-2026-08-08T16-03-16-896Z/`（未動過）。匯入時 89 張卡為 lossy（media/表格攤平）；Heptabase 的 tagList/cardTagList 已在分類階段融合進卡片 tags。
4. **注意**：對 card-note-data push 前先 `git pull --rebase`——routine 每 6 小時可能已推新 report commit。

## iOS 版（`gpwork4u/card-note-ios`，private，2026-08-09 起）

原生 SwiftUI（iOS 17+）第二客戶端——**同一個資料 repo、同一套 schemaVersion 2 檔案格式**，與 web 版互通同步。XcodeGen（`xcodegen generate` 產專案）、零第三方依賴、35 個測試。**完整架構與決策見該 repo `docs/ARCHITECTURE.md`**（含模組對照表、每個門檻的驗證紀錄）。發展歷程（PR #1-#8，全部已合併）：

1. **同步引擎已通過三道門檻，可安全連正式 card-note-data**：
   - **位元組級 parity**（PR #2）：合成 + 真實 320 檔 fixture 雙重比對（產生器在 `tools/`，真實 fixture 含個人筆記故 gitignore）。修掉引號規則、JS half-up 捨入、YAML block scalar 三個跨端差異。
   - **codex review 8 findings 全修**（PR #3）：原子 `state.json`（baseline+snapshot 單一寫入、MainActor 單一 writer、engine 不落盤）、同步期間編輯 rebase 保留、tree delete NSNull（原本 payload 連 JSONSerialization 都過不了）、actor 可重入、branch 驗證、resolution 完整性、schema 門檻、Keychain WhenUnlocked。
   - **live 多裝置測試**（PR #4）：對 card-note-sync-test 一次性 orphan branch 跑完整六階段（初次 push→adopt-remote parity→跨欄位合併→keep-both→README 不可侵犯→刪除傳播）。抓到真 bug：URLSession 預設遵守 GitHub 的 Cache-Control max-age=60 → stale head 死循環，已改 reloadIgnoringLocalCacheData。跑法：`TEST_RUNNER_LIVE_SYNC_TOKEN=$(gh auth token) TEST_RUNNER_LIVE_SYNC_REPO=gpwork4u/card-note-sync-test xcodebuild test … -only-testing:CardNoteTests/LiveSyncTests`。
2. **功能面與 web 版大致對等**：衝突解決 UI（PR #5，keep-both 預設、不可滑掉、DEBUG `-demoConflict` 預覽）、白板貝茲連線層+雙指縮放+三視圖 context menu（PR #6，`-demoBoard` 預覽）、背景同步 BGAppRefreshTask（PR #7）、AI provider（PR #8：AIProvider protocol + LocalProvider 離線啟發式 + ClaudeProvider raw HTTP——模型 entitlement fallback 序列與 web 相同、structured outputs、cached system block、count_tokens 驗 key；UI 有設定頁 key 欄位、卡片庫 AI 搜尋、卡片詳情建議連結）。
3. **鐵律**：兩端同步/序列化語意變更必須**同時改 web 與 iOS**，並重跑 parity fixture + live 測試。web `src/sync/conflict.ts` ↔ iOS `ThreeWayMerge.swift` 是鏡像。
4. **iOS 待驗證**：ClaudeProvider 真實 key live 呼叫（設定頁貼 key → AI 搜尋）；真機 BGTask 喚醒；真機實際安裝使用（至今只在模擬器跑過）。

## 臨時預覽模式（已於 2026-08-09 還原）

先前為了直接開 `http://localhost:5173/` 看整理成果，工作樹曾有臨時改動（seed.ts 讀 preview-data.json、DB_NAME 改 `card-note-preview5`），已全數還原、工作樹乾淨。若日後要再預覽 card-note-data 內容，建議做成正式的「預覽資料集」開關而非臨時改檔。

## 慣例 / 注意

- 純 inline style + 少量 `globals.css` 全域 class（`.scrl .hover-raise .hover-tint .reset-btn .icon-btn .anim-* .spinner .hscroll .mono .no-select .card-node .link-handle`）。沒有用 Tailwind；圖示用 lucide-react（釘 `0.454.0`，含 `Github` 品牌圖示）。
- **DOM 上的測試掛鉤**：`data-card-id`（白板卡片，拖曳命中測試也靠它）、`data-link-handle`、`data-link`（連結的正規 key）、`data-link-type`（`solid`/`ai`）。改動這些選擇器會直接弄壞 `tests/e2e/linkDrag.spec.ts`。
- 大型 UI 是用多個平行 subagent 產出（各視圖/importer 各一），核心型別/store/序列化/同步由主 session 定稿以確保契約一致。若要再委派 UI，務必先把 store/型別契約定好再給 agent。
- 語言：全程繁體中文 UI 與溝通。
