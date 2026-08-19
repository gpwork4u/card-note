# 語音草稿收件匣（iPhone 捷徑 → GitHub）

對著手機說一段話，轉錄結果直接變成資料 repo 裡的一個草稿檔。之後由 LLM agent 打標籤、整理，再決定要不要升級成正式卡片。

```
iPhone 捷徑（聽寫）
      │  一則一檔，檔名帶時間戳，永不覆寫
      ▼
card-note-data/inbox/2026-08-19-143205.md      ← 草稿（app 不碰）
      │  agent 讀 processed: false 的草稿，補 tags/summary
      ▼
inbox/…md（processed: true, tags: [...]）
      │  值得留的，agent 開 PR 轉成 cards/<ulid>.md
      ▼
card-note app 的卡片庫
```

## 為什麼放 `inbox/` 而不是 `cards/` 或 `diary/`

語音講出來的是碎片，還不是一張成形的卡片——沒有標題、沒有型別、沒有標籤。硬寫進 `cards/` 會讓卡片庫塞滿半成品；寫進 `diary/` 則會跟「當天的工作日記」語意混在一起。`inbox/` 是明確的暫存區：進來很便宜，出去要經過整理。

## ⚠️ `inbox/` 必須維持在 app 的擁有範圍之外

card-note 的同步引擎有一條規則：**遠端有、而本機序列化結果裡沒有的「app 擁有」檔案，會被當成「本機刪除」而從 repo 刪掉**（`src/sync/syncEngine.ts` 的 `buildChanges`）。

app 完全不解析也不序列化草稿，所以草稿必須被判定為「非擁有」。只要有人把 `'inbox/'` 加進 `OWNED_PREFIXES`，下一次同步就會把收件匣裡所有語音筆記刪光，而且是靜默刪除。

`tests/unit/ownedPaths.test.ts` 就是守這條線的回歸測試。要讓 app 真的顯示草稿，正確做法是**先**做完整的 draft 型別／store／序列化（web 與 iOS 兩端同步改），而不是只把前綴加進去。

## 草稿檔案格式

一則一檔，檔名 `inbox/<yyyy-MM-dd-HHmmss>.md`。時間戳當檔名 = 每次都是新檔，不必先讀後寫，也不會跟 routine 的 commit 撞在一起。

```markdown
---
created: 2026-08-19T14:32:05+08:00
source: voice
processed: false
tags: []
---
剛剛想到白板上應該可以直接從卡片邊緣拉一條線到另一張卡建立連結，比開詳情面板快很多。
```

| 欄位 | 意義 |
| --- | --- |
| `created` | ISO 8601 含時區，錄下的當下時間 |
| `source` | `voice`／`text`／`share`——日後從別的入口丟進來也用同一個收件匣 |
| `processed` | agent 是否已整理過。捷徑一律寫 `false` |
| `tags` | 捷徑留空陣列，由 agent 補上 |

格式刻意跟卡片／日記一樣是 YAML frontmatter + Markdown 內文，agent 與人都好讀。

## 一、建立專用的 GitHub token

給捷徑用的 token 要**只能碰資料 repo**，不要重用 app 的那把。

1. GitHub → Settings → Developer settings → Personal access tokens → **Fine-grained tokens** → Generate new token
2. Repository access：**Only select repositories** → 只勾 `card-note-data`
3. Permissions → Repository permissions → **Contents: Read and write**（其餘不給）
4. Expiration 設定到期日，到期再換一把

產出的 token 只會顯示一次，先複製著。

## 二、建立捷徑

「捷徑」App → 右上 `+` → 依序加入這些動作。

**1. 聽寫文字**
- 語言：國語（台灣）
- 停止聆聽：**輕點時**（想講多久講多久；選「暫停後」會在你思考時就切斷）

**2. 如果**（可選但建議）
- 條件：`聽寫的文字` **沒有值** → 加入「停止捷徑」
- 避免誤觸時推一個空草稿上去

**3. 格式化日期** → 取名記成「檔名時間」
- 日期：`目前日期`
- 格式：**自訂** → `yyyy-MM-dd-HHmmss`

**4. 格式化日期** → 這個是寫進 frontmatter 的
- 日期：`目前日期`
- 格式：**自訂** → `yyyy-MM-dd'T'HH:mm:ssZZZZZ`

**5. 文字**（草稿內容本體，變數用上一步的結果）

```
---
created: [格式化的日期 4]
source: voice
processed: false
tags: []
---
[聽寫的文字]
```

**6. Base64 編碼**
- 輸入：上一個「文字」動作的結果
- **換行：無**（一定要設，帶換行的 base64 GitHub 會拒收）

**7. 取得 URL 內容**
- URL：`https://api.github.com/repos/gpwork4u/card-note-data/contents/inbox/[格式化的日期 3].md`
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
  | `message` | 文字 | `voice note [格式化的日期 3]` |
  | `content` | 文字 | `[Base64 編碼結果]` |
  | `branch` | 文字 | `main` |

**8. 顯示通知**
- 標題：`已收進收件匣`
- 內文：`[聽寫的文字]`（順手確認轉錄有沒有出錯）

命名捷徑為「語音筆記」。

## 三、讓它一秒可及

挑一個順手的：

- **動作按鈕**（iPhone 15 Pro 以後）：設定 → 動作按鈕 → 捷徑 → 選「語音筆記」。最快，按住就錄。
- **背面輕點**：設定 → 輔助使用 → 觸控 → 背面輕點 → 輕點兩下 → 選捷徑。手套／口袋裡也能觸發。
- **鎖定畫面控制項**：長按鎖定畫面 → 自訂 → 加入捷徑控制項。
- **Siri**：直接說「嘿 Siri，語音筆記」——捷徑名稱就是喚醒詞。

## 四、讓 agent 消化收件匣

現有的 Claude routine「card-note 筆記整理助手」（每 6 小時）加上這段工作即可。標籤要沿用卡片庫既有的標籤體系，否則調研時對不起來。

```
除了既有工作，另外處理語音草稿收件匣：

1. 列出 inbox/ 裡 frontmatter 為 processed: false 的檔案。沒有就跳過這一段。
2. 每一則草稿：
   - 讀完內文，判斷它在講什麼。
   - 從卡片庫既有的標籤中挑 2-4 個最貼切的（先看過 cards/ 現有 tags 再決定，
     優先重用既有標籤；真的沒有合適的才新增，並在 PR 說明裡點出新標籤）。
   - 語音轉錄常有錯字與口語贅詞，在 frontmatter 加一行 summary，
     用一句書面繁中重述這則草稿在講什麼。不要改動原始內文——
     那是逐字紀錄，要保留可回溯性。
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
| 回 `422` 且訊息提到 `sha` | 同一秒錄了兩則，檔名撞了。極罕見，再錄一次即可；真的常撞就把檔名格式加上隨機數。 |
| 內文變成亂碼或多了 `\n` | Base64 編碼動作的「換行」沒設成**無**。 |
| 中文轉錄品質差 | 聽寫語言要設「國語（台灣）」。設定 → 一般 → 鍵盤 → 啟用聽寫，並下載離線語音辨識。 |
| 草稿在 app 裡看不到 | 這是設計如此——`inbox/` 不是 app 擁有的目錄，見上面的警告章節。 |

## 安全性

token 以明文存在捷徑裡，拿到你解鎖的手機就能讀到。所以：權限只給 `card-note-data` 的 Contents、設到期日、手機遺失時第一時間到 GitHub 撤銷該 token。它撈不到你其他的 repo，最壞情況是那個資料 repo 被寫入。
