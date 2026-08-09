# 卡片盒筆記系統 — Session Handoff

> 給下一個 session 接續用。最後更新：2026-08-09。專案路徑：`/Volumes/2tb/project/card-note`。

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
- ✅ **AI 骨架**：本機關鍵字/標籤 provider（search/suggestLinks/extractDiary/classify），Claude provider 為預留 stub。
- ✅ IndexedDB 持久化 + 舊資料自動遷移成預設白板。
- ✅ 圖示全面改用 **lucide-react**（shadcn 的圖示庫）。響應式（桌機 rail+詳情面板 / 手機底部 tab+全螢幕 sheet）。

## 如何執行 / 驗證

```bash
cd /Volumes/2tb/project/card-note
npm install          # 首次
npm run dev -- --host   # 開發（目前正跑在 http://localhost:5173/）
npm run build        # tsc --noEmit && vite build（型別+建置驗證）
npm run typecheck
```

**冒煙測試**：用 Playwright（已裝為 devDependency）。測試腳本寫在 scratchpad（`/private/tmp/.../scratchpad/*.mjs`，**非專案內、會被清掉**），做法是：`import pw from '<絕對路徑>/node_modules/playwright/index.js'`，`chromium.launch()` → 對 `http://localhost:5173/` 操作 → 檢查文字/截圖 + 收集 console error。資料完整性用 esbuild 打包一個 `@` alias 的 .ts 測試檔跑 node（serialize/parse round-trip、三方合併等）。**建議下一步把這些變成專案內正式測試（vitest + playwright）。**

## 架構關鍵（重要決策）

1. **同步用 GitHub REST API 直連瀏覽器（非 isomorphic-git、無 CORS proxy）**：已驗證 `api.github.com` 支援 CORS、fine-grained PAT 可走 Authorization header。使用者選擇「用 repo token + API」。
2. **AI 先做骨架**：使用者選擇之後再接 Claude。`src/ai/` 是 provider 介面層，接 Claude 是 drop-in（見 `src/ai/claude.ts` 內的接線註解：`@anthropic-ai/sdk` + `dangerouslyAllowBrowser`、模型 `claude-sonnet-4-6`/`claude-haiku-4-5`、`output_config.format` structured output）。
3. **多白板（多對多）**：卡片不存座標，位置存在 board placement。
4. **只碰 app 擁有的檔案**：sync 的 `OWNED_PREFIXES = cards/ projects/ diary/ boards/ + links.ndjson + cardnote.json`；repo 內其他檔（README 等）絕不被刪或合併。

## 資料模型 / git 檔案格式（schemaVersion 2）

```
<repo>/
├── cardnote.json          { schemaVersion:2, app:"card-note" }
├── cards/<ulid>.md        frontmatter(id,type,title,tags,created,updated) + markdown body（無 x/y）
├── boards/<id>.json       { id, name, placements:[{cardId,x,y}] }
├── links.ndjson           已確認連結（solid），每行一條、排序；AI 建議連結不進 git
├── projects/<id>.json     { id, name, color, cols:{todo,doing,done:[cardId]} }
└── diary/<YYYY-MM-DD>.md   frontmatter(date,processed,extracted) + body
```

型別定義：`src/types/index.ts`（`Card`, `Board`, `Placement`, `Link`, `Project`, `DiaryEntry`, AI 契約, Sync 契約, `ImportReport`）。

## 模組地圖（src/）

```
store/index.ts        Zustand 單一 store（所有 state + actions）；persist.ts 做 IndexedDB 鏡像 + bootstrap 遷移
types/index.ts        全型別
lib/                  tokens(色票/型別表/KANBAN_COLUMNS) derive(enrichCard/boardView/linkKey/inferType)
                      bezier ulid format base64 gitBlobSha text cardMenu(右鍵選單項建構器)
serialization/        card/board/links/project/diary ↔ 檔案；index.ts 的 serializeAll/parseAll 是 git 檔案地圖邊界
sync/                 githubApi(REST client) syncEngine(狀態機/三方合併) conflict(threeWayMerge/keep-both) localCache(IndexedDB)
ai/                   index(公開 API aiSearch/aiSuggestLinks/aiExtractDiary/aiClassify) local(現用) claude(stub)
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

1. ✅ **GitHub 同步 live 測試已通過（2026-07-08）**：對真實 repo `gpwork4u/card-note-sync-test` 用 app 的 syncEngine 跑完整輪：初次 push → 第二裝置 pull → 同卡雙改 → conflict → keep-both 解決 → 另一裝置拉回合併。非 app 擁有的檔案（README.md）確認原封不動。測試 harness 在 scratchpad（esbuild 打包 + 檔案版 localCache stub），必要時可重建。
2. ✅ **Claude API 已接（2026-07-08，後經 codex 六輪 review 修正、PR #2 已合併）**：`ClaudeProvider` 實作完成（structured outputs、cached system block、refusal/錯誤處理、模型 entitlement fallback opus-4-8→sonnet-5→haiku-4-5、啟用前 count_tokens 驗證 key）。**尚未用真實 API key 做過 live 呼叫測試**——在設定頁貼 key 後試 AI 搜尋即可驗證。
3. ✅ **正式測試已建（2026-07-08）**：`npm test`（vitest 單元 ×24：round-trip、三方合併、衝突解決、gitBlobSha）+ `npm run test:e2e`（playwright 冒煙：四視圖零 console error，自動起 dev server）。
4. ✅ **app 已 git init 並上 GitHub（2026-07-08）**：`gpwork4u/card-note`（private）。之後變更走分支 + PR（見 git-commit-push 慣例）。
5. 其他可加：白板上拖曳建立連結、白板排序/封存、圖片/附件處理、AI 建議連結持久化選項。

## 資料生態系（2026-08-09 之後的營運狀態）

app 本身之外，現在有一整條「資料 repo + 雲端 routine」的營運線：

1. **正式資料 repo：`gpwork4u/card-note-data`（private）**。現況：**285 張卡片**（85 張 `~/project` 本機專案盤點卡 + 200 張 Heptabase 匯入卡）、**31 個白板**（30 個 Heptabase 原始白板 + 「專案總覽」）、**1 個看板專案**「本機專案」（待開發 22／進行中 57／已完成 6）、`links.ndjson` 17 條、1 則工作日記。所有卡片經過內容導向分類（型別 tech 94/idea 79/design 20/…，每張 3-5 個標籤）。使用者明確要求：**不要重建/合併 Heptabase 白板，分類做好即可**。
2. **Claude routine「card-note 筆記整理助手」**（trigger `trig_013kQVPKcbXZUcDLCQrA7arp`，每 6 小時，sonnet-5，管理頁 https://claude.ai/code/routines/trig_013kQVPKcbXZUcDLCQrA7arp ）。行為：讀 card-note-data → 直接 commit `reports/digest-<日期>.md` 到 main；連結建議/日記擷取走 PR。**已驗證整條路**：產出兩份報告、開出 PR #1（8 組連結建議，人工逐一核實後於 2026-08-09 合併，links 9→17）。
3. **Heptabase 原始備份**：`/Users/gpwang/Documents/heptabase/Heptabase-Data-Backup-2026-08-08T16-03-16-896Z/`（未動過）。匯入時 89 張卡為 lossy（media/表格攤平）；Heptabase 的 tagList/cardTagList 已在分類階段融合進卡片 tags。
4. **注意**：對 card-note-data push 前先 `git pull --rebase`——routine 每 6 小時可能已推新 report commit。

## 臨時預覽模式（已於 2026-08-09 還原）

先前為了直接開 `http://localhost:5173/` 看整理成果，工作樹曾有臨時改動（seed.ts 讀 preview-data.json、DB_NAME 改 `card-note-preview5`），已全數還原、工作樹乾淨。若日後要再預覽 card-note-data 內容，建議做成正式的「預覽資料集」開關而非臨時改檔。

## 慣例 / 注意

- 純 inline style + 少量 `globals.css` 全域 class（`.scrl .hover-raise .hover-tint .reset-btn .icon-btn .anim-* .spinner .hscroll .mono`）。沒有用 Tailwind；圖示用 lucide-react（釘 `0.454.0`，含 `Github` 品牌圖示）。
- 大型 UI 是用多個平行 subagent 產出（各視圖/importer 各一），核心型別/store/序列化/同步由主 session 定稿以確保契約一致。若要再委派 UI，務必先把 store/型別契約定好再給 agent。
- 語言：全程繁體中文 UI 與溝通。
