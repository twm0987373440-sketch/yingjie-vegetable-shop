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
