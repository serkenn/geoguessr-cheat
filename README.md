# ApvGuesser - GeoGuessr 用 Chrome 拡張機能
![APV_GUESSR_HEADER](https://github.com/realapire/geoguessr-cheat/assets/111300928/67d869d9-8747-49f0-84aa-27496acf9697)

- **主要なすべてのゲームモードで動作確認済み**<br>
- **機能: 自動位置測位 / 自動ピン配置 / 自動 Guess 送信 / 位置情報ポップアップ表示**<br>

## 機能一覧

| 機能 | 説明 |
|------|------|
| **自動位置測位** | Google StreetView メタデータおよび GeoGuessr API レスポンスから座標を自動抽出。画面右下にステータス表示。 |
| **自動ピン配置** | 測位された座標をマップ上に自動でピン留め。 |
| **自動 Guess 送信** | ピン配置後、ランダムな遅延を挟んで自動で Guess ボタンを押下・送信。 |
| **位置情報ポップアップ** | 逆ジオコーディングで取得した住所情報をポップアップ表示。 |
| **Safe Mode** | 有効時、ピン位置に ±0.5〜2.5° のランダムオフセットを付加（完全正答を避ける）。 |

## 使い方

### 1. インストール
1. このリポジトリをローカル環境にクローン、またはダウンロードします。
2. Google Chrome を開き、`chrome://extensions/` にアクセスします。
3. 右上にある「デベロッパー モード」をオンにします。
4. 「パッケージ化されていない拡張機能を読み込む」をクリックし、拡張機能ファイルを保存したフォルダを選択します。

### 2. 自動モード（デフォルト）
- 拡張機能をインストール後、GeoGuessr のゲームセッションを開くだけで動作します。
- StreetView の読み込み時に座標を自動検出し、**自動でピンを配置 → 自動で Guess を送信** します。
- 画面右下にステータス通知（検出座標・送信状況）が表示されます。

### 3. 手動モード
ゲーム画面右側のコントロールボタンからも操作できます:
- 🔍 **目のアイコン** — 位置情報ポップアップを表示
- 📌 **ピンのアイコン** — マップにピンを配置して Guess を送信

### 4. キーバインド
> **以下のキーバインドは Safe Mode がオフのときのみ動作します**

| ショートカット | 動作 |
|---------------|------|
| `Ctrl + Shift` | 位置情報ポップアップを表示 |
| `Ctrl + Space` | マップにピンを配置して Guess を送信 |

### 5. 設定
ゲーム内の Settings タブに以下のトグルが追加されます:

| 設定 | 説明 | デフォルト |
|------|------|-----------|
| **Safe Mode** | ピン位置にランダムオフセットを加算（バレ防止） | ON |
| **Auto Guess** | 座標検出時に自動でピン配置 → Guess 送信 | ON |

<hr>

ApvGuessr なしのユーザーインターフェース:<br>
![image](https://github.com/realapire/geoguessr-cheat/assets/111300928/365ef2d8-5b58-437b-9727-9f126da66c66)
![image](https://github.com/realapire/geoguessr-cheat/assets/111300928/7ebde62d-dd3b-4160-b28e-529c017a02a9)

ApvGuessr ありのユーザーインターフェース:

![image](https://github.com/realapire/geoguessr-cheat/assets/111300928/87441a6f-0fdb-4032-9600-73cb5f16bdd9)
![image](https://github.com/realapire/geoguessr-cheat/assets/111300928/21542d7f-06f7-4d17-b6ee-7f0021a91038)
