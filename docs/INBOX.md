# 收件匣（`inbox/`）— 從 iPhone 隨手丟東西進資料 repo

兩個 iPhone 捷徑，一個講話、一個分享連結，收進同一個暫存區。之後由 LLM agent 打標籤、整理，值得留的再升級成正式卡片。

```
iPhone 捷徑
  ├─ 語音筆記（動作按鈕／Siri）── 內建聽寫 ──┐
  └─ 分享連結（分享表單）──── 網址＋備註 ──┤  一則一檔，檔名帶時間戳，永不覆寫
                                            ▼
card-note-data/inbox/2026-08-25-101530.md      ← 草稿（app 不碰）
                                            │  agent 讀 processed: false 的草稿，補 tags/summary
                                            ▼
inbox/…md（processed: true, tags: [...]）
                                            │  值得留的，agent 開 PR 轉成 cards/<ulid>.md
                                            ▼
                                    card-note app 的卡片庫
```

## 為什麼所有東西都先進 `inbox/`

隨手存下來的東西——講到一半的想法、還沒讀的連結——都還不是一張成形的卡片：沒有標題、沒有型別、沒有標籤。硬寫進 `cards/` 會讓卡片庫塞滿半成品，寫進 `diary/` 又和「當天的工作日記」語意混淆。`inbox/` 是明確的暫存區：進來很便宜，出去要經過整理。

## ⚠️ `inbox/` 必須維持在 app 的擁有範圍之外

card-note 的同步引擎有一條規則：**遠端有、而本機序列化結果裡沒有的「app 擁有」檔案，會被當成「本機刪除」而從 repo 刪掉**（`src/sync/syncEngine.ts` 的 `buildChanges`）。

app 完全不解析也不序列化草稿，所以草稿必須被判定為「非擁有」。只要有人把 `'inbox/'` 加進 `OWNED_PREFIXES`，下一次同步就會把收件匣裡所有草稿刪光，而且是靜默刪除。

`tests/unit/ownedPaths.test.ts` 就是守這條線的回歸測試。要讓 app 真的顯示草稿，正確做法是**先**做完整的 draft 型別／store／序列化（web 與 iOS 兩端同步改），而不是只把前綴加進去。

## 草稿檔案格式

一則一檔，檔名 `inbox/<yyyy-MM-dd-HHmmss>.md`。時間戳當檔名 = 每次都是新檔，不必先讀後寫，也不會跟 routine 的 commit 撞在一起。

**語音草稿**

```markdown
---
created: 2026-08-25T10:15:30+08:00
source: voice
processed: false
tags: []
---
剛剛想到白板上應該可以直接從卡片邊緣拉一條線到另一張卡建立連結，比開詳情面板快很多。
```

**連結草稿**

```markdown
---
created: 2026-08-25T10:15:30+08:00
source: link
url: 'https://example.com/a-post'
processed: false
tags: []
---
# 頁面標題

分享當下順手寫的備註（可留空）
```

| 欄位 | 意義 |
| --- | --- |
| `created` | ISO 8601 含時區，存下的當刻 |
| `source` | `voice` / `link`——日後多開別的入口也用同一個收件匣 |
| `url` | 只有 `link` 有。**用單引號包起來** |
| `processed` | agent 是否已整理過。捷徑一律寫 `false` |
| `tags` | 捷徑留空陣列，由 agent 補上 |

**為什麼標題放在內文而不是 frontmatter**：網頁標題常含冒號、引號、`|`、emoji，塞進 YAML 純量會直接讓 frontmatter 解析失敗。放進 Markdown 內文當 H1 就沒有任何跳脫問題，人讀起來也自然。`url` 留在 frontmatter 是因為 agent 要用它去抓頁面，用單引號包住即可安全（YAML 單引號字串只需把 `'` 寫成 `''`，而網址裡幾乎不會有單引號）。`tests/unit/inboxDraft.test.ts` 用惡意標題／備註驗證了這個格式解得開。

## 一、建立專用的 GitHub token（兩個捷徑共用）

給捷徑用的 token 要**只能碰資料 repo**，不要重用 app 的那把。

1. GitHub → Settings → Developer settings → Personal access tokens → **Fine-grained tokens** → Generate new token
2. Repository access：**Only select repositories** → 只勾 `card-note-data`
3. Permissions → Repository permissions → **Contents: Read and write**（其餘不給）
4. Expiration 設定到期日，到期再換一把

產出的 token 只會顯示一次，先複製著。

---

## 二、捷徑 A：語音筆記

「捷徑」App → 右上 `+` → 依序加入這些動作。

**1. 聽寫文字**
- 語言：國語（台灣）
- 停止聆聽：**輕點時**（想講多久講多久；選「暫停後」會在你思考時就切斷）

**2. 如果**（可選但建議）
- 條件：`聽寫的文字` **沒有值** → 加入「停止捷徑」
- 避免誤觸時推一個空草稿上去

**3. 格式化日期** → 這個給檔名用
- 日期：`目前日期`，格式：**自訂** → `yyyy-MM-dd-HHmmss`

**4. 格式化日期** → 這個寫進 frontmatter
- 日期：`目前日期`，格式：**自訂** → `yyyy-MM-dd'T'HH:mm:ssZZZZZ`

**5. 文字**（草稿內容本體）

```
---
created: [格式化的日期 4]
source: voice
processed: false
tags: []
---
[聽寫的文字]
```

**6. Base64 編碼** → 輸入為上一個「文字」動作，**換行：無**

**7. 取得 URL 內容** → 見下方「共用的上傳步驟」

**8. 顯示通知** → 標題 `已收進收件匣`，內文 `[聽寫的文字]`（順手確認轉錄有沒有出錯）

命名為「語音筆記」。

### 讓它一秒可及

- **動作按鈕**（iPhone 15 Pro 以後）：設定 → 動作按鈕 → 捷徑 → 選「語音筆記」。最快，按住就錄。
- **背面輕點**：設定 → 輔助使用 → 觸控 → 背面輕點 → 輕點兩下 → 選捷徑。
- **鎖定畫面控制項**：長按鎖定畫面 → 自訂 → 加入捷徑控制項。
- **Siri**：直接說「嘿 Siri，語音筆記」——捷徑名稱就是喚醒詞。

---

## 三、捷徑 B：分享連結

新建一個捷徑，命名為「存進收件匣」。

**先設定分享表單**：捷徑編輯畫面右上 `ⓘ`（詳細資訊）→ 開啟 **在分享表單中顯示** → 接受的輸入類型只勾 **URL**、**Safari 網頁**、**文字**（其餘取消，免得在照片之類的分享表單裡出現）。

**1. 取得輸入中的網址**
- 輸入：`捷徑輸入`
- 從各種來源（Safari、YouTube、Threads、RSS 閱讀器…）撈出真正的網址

**2. 如果**（建議）
- 條件：上一步結果 **沒有值** → 「顯示提示」告知沒抓到網址 → 「停止捷徑」

**3. 取得名稱**
- 輸入：`捷徑輸入`
- 拿網頁標題。**這步是盡力而為**：某些 app 分享出來的項目沒有標題，取得空字串也沒關係，agent 之後會補。

**4. 詢問輸入**
- 提示：`為什麼想存這條？（可留空）`
- 輸入類型：文字
- 這一句當下的理由，日後調研時價值很高——agent 也會拿它判斷該打什麼標籤。

**5. 格式化日期** → 檔名用，格式 `yyyy-MM-dd-HHmmss`

**6. 格式化日期** → frontmatter 用，格式 `yyyy-MM-dd'T'HH:mm:ssZZZZZ`

**7. 文字**

```
---
created: [格式化的日期 6]
source: link
url: '[網址]'
processed: false
tags: []
---
# [名稱]

[提供的輸入]
```

（`[網址]` 是步驟 1 的結果、`[名稱]` 是步驟 3、`[提供的輸入]` 是步驟 4。）

**8. Base64 編碼** → 輸入為上一個「文字」動作，**換行：無**

**9. 取得 URL 內容** → 見下方「共用的上傳步驟」

**10. 顯示通知** → 標題 `已收進收件匣`，內文 `[名稱]`

用法：在 Safari／任何 app 點分享 → 選「存進收件匣」→ 打一句話（或直接按完成）→ 收工。

---

## 共用的上傳步驟（兩個捷徑最後都一樣）

**取得 URL 內容**
- URL：`https://api.github.com/repos/gpwork4u/card-note-data/contents/inbox/[檔名用的日期].md`
- 方法：**PUT**
- 標頭：
  | 鍵 | 值 |
  | --- | --- |
  | `Authorization` | `Bearer <你的 token>` |
  | `Accept` | `application/vnd.github+json` |
  | `X-GitHub-Api-Version` | `2022-11-28` |
- 請求內文：**JSON**
  | 鍵 | 型別 | 值 |
  | --- | --- | --- |
  | `message` | 文字 | `inbox: [檔名用的日期]` |
  | `content` | 文字 | `[Base64 編碼結果]` |
  | `branch` | 文字 | `main` |

---

## 四、讓 agent 消化收件匣

現有的 Claude routine「card-note 筆記整理助手」（每 6 小時）加上這段工作即可。標籤要沿用卡片庫既有的標籤體系，否則調研時對不起來。

```
除了既有工作，另外處理收件匣：

1. 列出 inbox/ 裡 frontmatter 為 processed: false 的檔案。沒有就跳過這一段。
2. 每一則草稿：
   - 讀完內容，判斷它在講什麼。
   - source: link 的草稿，用 url 去讀那個頁面，理解它實際在談什麼，
     不要只看標題臆測。內文的 H1 是分享當下抓到的標題（可能為空或不準），
     讀完頁面後在 frontmatter 補一行 summary 用一兩句書面繁中說明這個連結的內容，
     並修正 H1 為準確的標題。內文裡我自己寫的備註不要動——那是我當下的想法。
   - source: voice 的草稿，語音轉錄常有錯字與口語贅詞，同樣加 summary 用一句
     書面繁中重述。不要改動原始逐字稿，那要保留可回溯性。
   - 從卡片庫既有的標籤中挑 2-4 個最貼切的（先看過 cards/ 現有 tags 再決定，
     優先重用既有標籤；真的沒有合適的才新增，並在 PR 說明裡點出新標籤）。
     如果我有寫備註，備註透露的意圖比頁面主題更重要。
   - 把 processed 改成 true，填上 tags 與 summary。
3. 其中若有已經成形、值得變成永久卡片的想法，在 PR 裡一併提案：
   建立對應的 cards/<ulid>.md（依 schemaVersion 2 格式），並在草稿的
   frontmatter 加上 promoted_to: <卡片 id> 做回溯。不確定的就只打標籤，
   留著讓我自己判斷。
4. 收件匣的變更一律走 PR，不要直接 commit 到 main——這些是我的原始紀錄。
```

## 疑難排解

| 症狀 | 原因 |
| --- | --- |
| 捷徑回 `401` | token 打錯或已過期。注意 `Authorization` 的值要有 `Bearer ` 前綴。 |
| 回 `404` | token 沒有勾到 `card-note-data`，或 repo 名稱拼錯。fine-grained token 對沒授權的 private repo 一律回 404 而不是 403。 |
| 回 `422` 且訊息提到 `sha` | 同一秒存了兩則，檔名撞了。極罕見，再存一次即可。 |
| 內文變成亂碼或多了 `\n` | Base64 編碼動作的「換行」沒設成**無**。 |
| 分享表單裡找不到捷徑 | 詳細資訊裡的「在分享表單中顯示」沒開，或接受的輸入類型沒勾到 URL／Safari 網頁。 |
| 分享時抓不到網址 | 該 app 分享出來的是純文字而非網址。捷徑的「取得輸入中的網址」也會從純文字裡撈網址，真的沒有就會走到停止分支。 |
| 中文轉錄品質差 | 聽寫語言要設「國語（台灣）」。設定 → 一般 → 鍵盤 → 啟用聽寫，並下載離線語音辨識。 |
| 草稿在 app 裡看不到 | 這是設計如此——`inbox/` 不是 app 擁有的目錄，見上面的警告章節。 |

## 安全性

token 以明文存在捷徑裡，拿到你解鎖的手機就能讀到。所以：權限只給 `card-note-data` 的 Contents、設到期日、手機遺失時第一時間到 GitHub 撤銷該 token。它撈不到你其他的 repo，最壞情況是那個資料 repo 被寫入。
