# 英姐蔬果商行更新版

已依確認版型製作：深灰綠、暖黃色按鈕、蔬果橫幅、店家公告、五個分類、雙欄商品照片、數量加減、底部結帳摘要。保留購物車、LINE 會員入口、店家資訊與後台訂單管理。

## 更新 GitHub 網站

1. 先在 GitHub 專案 Code → Download ZIP 備份現有網站。
2. 解壓縮「英姐蔬果商行-更新版.zip」。
3. 將裡面的檔案上傳到原專案根目錄，覆蓋同名檔案。不要直接上傳 ZIP，不要在外面多包一層資料夾。
4. 必須一起上傳 index.html、admin.html、app.js、admin.js、style.css、theme.css、shop-utils.js、firebase-config.js，以及 vegetable-hero.png。
5. Commit changes，等待 GitHub Pages 部署完成，重新整理前台及後台。

原 Firebase 設定與 LINE 登入網址已保留，無須重建商品或訂單。檔案更新不會主動寫入既有資料庫。

## Firebase 規則

原附檔 firestore.rules 禁止所有人修改商品，也未開放店家資訊讀取。新版本允許原 admin.js 指定的同一個管理員 UID 管理商品、訂單與店家資訊；訪客只能讀商品／店家公開資訊及建立訂單，不能讀取別人的訂單。

Firebase Console → Firestore Database → Rules：先備份目前線上規則，再套用附檔並發布。**把 firestore.rules 放進 GitHub 不會自動更新 Firebase 規則。** 若線上已有其他集合或較新的規則，請先比較、合併對應區段，不要覆蓋其他用途的規則。管理員 UID 沿用你提供的 admin.js，請確認是目前使用的管理員。

本次沒有寫入正式資料庫，也没有代為發布上述規則。

## 上傳商品照片

後台登入 → 商品管理 → 編輯 → 選擇／更換照片 → 確認預覽 → **儲存商品**。

- 支援 JPG、PNG、WebP；HEIC 請先轉 JPG。
- 原圖上限 20 MB，自動等比例縮小到長邊最多 1000 像素並轉成 JPEG，資料字串限制 550,000 字元。
- 不裁掉原照片；商品卡顯示裁切縮圖，點擊看完整照片。
- 更換、移除都要按「儲存商品」才生效；取消會放棄本次編輯。
- 照片存入 Firestore products 文件的 photo 欄位，不需另外開通 Firebase Storage。
- 顧客重新整理後看到更新；未上傳時顯示「照片準備中」。

未附真實商品照片，請從後台加入實拍照片。橫幅為 AI 生成的裝飾图，可替換 vegetable-hero.png。

## 分類與公告

- 編輯商品可選葉菜類、根莖類、菇類、水果、其他蔬果。
- 舊商品未設分類時依常見名稱推定，可在後台更正；其他蔬果顯示在「今日新鮮」。
- 店家資訊 → 首頁公告 → 儲存；公告固定在橫幅下方、分類上方，支援換行。
- 名稱、價格、排序及上下架仍可在後台修改。

## 驗證範圍

本機隔離測試已確認分類、數量加減、3 件合計 NT$145、結帳送單後清空購物車；照片選取壓縮、儲存、前台顯示、放大、取消移除與儲存移除；公告更新；320／390 像素手機版。程式語法及照片網址驗證、購物車排除圖片資料、價格更新與失效商品清理檢查通過。

正式 Firebase 權限、管理員登入與 LINE 登入需部署後在你的帳號環境確認。本機使用替身服務，未驗證正式雲端連線；規則尚未在 Firebase Emulator 或線上環境驗證。

上線後請先上傳一張照片確認前台，再自行建立一筆測試訂單確認後台收到。

## 設計資產

內建 imagegen 生成 vegetable-hero.png。提示詞：Photorealistic editorial banner photograph for a Taiwanese fresh vegetable shop, landscape 3:1 composition. Right 65 percent: rustic woven basket with fresh cabbage, broccoli, bok choy, carrots, ripe tomatoes, shimeji mushrooms on warm worn wood. Left 35 percent deliberately dark soft out-of-focus olive green garden background for website headline overlay, no items on left. Natural morning side light, appetizing fresh vegetables with subtle dew, sophisticated forest green palette, natural and authentic, not oversaturated. No text, no letters, no logos, no framing, no UI. This is a decorative website hero background.

## 商品示意照片

目前 45 種商品附有 AI 生成的蔬菜示意照片，於商品頁標示「示意圖」。後台上傳並儲存商品照片後，會優先顯示店家照片；移除後恢復示意圖。圖片檔位於 `images/products/`，名稱對應在 `product-photos.js`。新商品若未列入對照表，仍顯示原本的照片準備中畫面。

## 商品上下架開關

後台「商品管理」的每項商品都有上架開關，切換後立即儲存。關閉只將 `active` 設為 `false`，商品、價格及照片仍保留在後台，隨時可按「編輯」修改，再打開重新上架。編輯視窗內的上架選項仍需按「儲存商品」。

客戶重新整理前台後看到最新上架清單。開關儲存期間會暫停該商品的操作；失敗時保留原狀並提示重試。此功能沿用既有 Firestore 管理員權限，無須新增付費服務。

隔離驗證已通過：上架、下架、重新上架、舊商品未設定 active、儲存失敗恢復操作、只更新 active 且保留價格／照片；JavaScript 語法檢查通過。未修改正式商品資料。


## 3包50元專區

專區改為手動加入，既有商品預設不參加，取消依價格自動加入。後台 → 商品管理 → 詳細編輯（或新增商品）→ 勾選「加入3包50元專區」→ 儲存商品。以 `bundle3for50: true` 記錄參加資格，需上架、單價20元且單位為包。取消勾選即可移出專區，商品仍保留在一般商品中。下架或改價後暫停優惠；恢復上架及每包20元後，先前勾選的商品恢復優惠。

專區可跨商品混搭，每3包折10元，未滿3包每包20元；6包100元、4包70元。既有訂單維持原金額。

購物車、底部結帳摘要、訂單儲存與送出成功畫面使用同一個計價函式。訂單保留原單價，另記錄subtotal、discount、bundleQty、promotion及折扣後total；後台顯示折扣，舊訂單不重新計價。


## LINE 店主下單通知（2026-10-05）

正式前台已改呼叫既有 `yingjie-line-login` Worker 的 `POST /orders`。Worker 在 Firestore 成功建立訂單後發送 LINE 訊息，訊息包含訂單編號、金額與後台連結；顧客姓名、電話及備註不放進 LINE 通知。原會員登入路由保留。

### 正式環境
- Worker 的 Secret：`LINE_CHANNEL_ACCESS_TOKEN`、`LINE_OWNER_USER_ID`，已加密設定；不要填入前台或提交到 Git。
- D1 binding：`ORDER_DB`，資料庫 `yingjie-order-notifications`。
- Worker 排程：每五分鐘執行 `retryOrderNotifications(env)`。網路或 LINE 暫時錯誤以退避間隔重試，首次發送起23小時後停止，避免超出 LINE 的24小時去重期限。永久錯誤標記 `sent=-1`，需管理員處理。
- D1 在存單成功後清除暫存的顧客資料，保留訂單ID、金額、去重雜湊及通知狀態。未成功存單的暫存資料保留，便於處理不明結果。
- `sent=1` 表示 LINE API 接受訊息，不代表手機已讀或推播一定顯示；店主須將官方帳號加為好友且未封鎖。

### 程式維護
`worker/order-service.mjs` 是可測試的服務模組，**不可單獨覆蓋原 Worker**。目前 Dashboard 部署保留原登入程式，將原 `export default` 物件改名為 `legacyWorker`，整合此模組，並使用以下入口（若拆成模組部署，可直接 import）：

```js
import { orderApi, retryOrderNotifications } from "./order-service.mjs";
// legacyWorker 為原本完整的 LINE Login 處理程式。
export default {
  async fetch(request, env, ctx) {
    if (new URL(request.url).pathname === "/orders") {
      return orderApi(request, env, ctx);
    }
    return legacyWorker.fetch(request, env);
  },
  async scheduled(event, env, ctx) {
    ctx.waitUntil(retryOrderNotifications(env));
  }
};
```

修改 GitHub 的服務模組不會自動部署 Worker；更新時須同步 Cloudflare 程式並保留既有 Secret、D1 binding 與排程。前台則由 GitHub Pages 發布。

### 檢查與故障處理
前台使用固定 request ID 重試同一筆訂單。網路出錯時保留購物車及待確認ID，勿手動清除瀏覽器資料後立刻重下。若 Firestore 已寫入、但回應中斷導致狀態不明，重試可能被現有 Firestore 權限拒絕，應由管理員依 D1 的 order_id 對照後台確認，避免重複下單。本次未放寬 Firestore 權限，Worker 沒有讀取顧客訂單的管理員權限。

在 D1 Console 查詢通知狀態：
```sql
SELECT order_id,total,saved,sent,attempts,last_error
FROM order_notifications ORDER BY created DESC LIMIT 20;
```

`saved=1` 表示已確認建立訂單；`sent=0` 待發送，`sent=1` LINE接受，`sent=-1` 需人工處理。權限、金鑰或額度錯誤修正後，只應人工重試已核對的紀錄，注意去重期限。

### 驗證
已在正式網站送出一筆標示「系統測試－請勿備貨」的三包優惠訂單：原價60、折扣10、合計50；前台成功並清空購物車，D1確認存單成功，LINE在第一次請求接受訊息。測試單保留於正式訂單中，請勿備貨。

隔離測試涵蓋儲存失敗不發送、同ID重試、內容衝突、Origin檢查、金額檢查、CORS、LINE重試及去重、永久錯誤停止。測試需 Node.js 24（使用內建 SQLite）：
```sh
node worker/order-service.test.mjs
```
