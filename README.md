# Track Log PWA v2.4.0

今回の版では、GitHubのアップロード時に `icons/` フォルダの中身だけがリポジトリ直下へ配置されてしまった場合に、アプリ側が `./icons/...` を探してアイコンが壊れる問題を解消しました。

## 重要な変更

- アイコン画像をすべて `index.html` と同じ **リポジトリ直下** に配置する方式へ変更。
- `index.html` / `manifest.webmanifest` / `service-worker.js` / PWA診断の参照先もすべてルート直下へ統一。
- ファイル名を `v240` に変更し、Android / Chrome が保持している旧アイコンキャッシュと分離。
- 通常アイコン 192/512、maskable 192/512、Apple Touch Icon、favicon を収録。
- アプリ画面のロゴは、万一画像取得に失敗しても `TL` のフォールバックが残る構成。
- Service Worker の事前キャッシュは1ファイルの取得失敗で全体インストールが失敗しないよう改善。
- オンライン時 Network First + `cache:no-store` と `version.json` の最新版確認は維持。
- v2.3までの試合、3日/7日分析、ウェイト専用フォーム、カスタムメニュー、疲労感、プリセット等の機能は維持。

## GitHubへアップロードするファイル

ZIPを解凍した **中身をすべて** `track-log` リポジトリ直下へアップロードしてください。今回は `icons` フォルダを作る必要はありません。

主な構成:

```text
index.html
app.js
coach.js
db.js
styles.css
manifest.webmanifest
service-worker.js
version.json
.nojekyll
favicon.ico
favicon-32-v240.png
favicon-48-v240.png
apple-touch-icon-v240.png
icon-192-v240.png
icon-512-v240.png
maskable-192-v240.png
maskable-512-v240.png
icon-1024-v240.png
```

## 更新後のアイコン確認

1. GitHub Pagesへ全ファイルを反映。
2. ブラウザでページを開き、設定 → PWA診断で「PWAアイコン v240（ルート直下） 読込OK」を確認。
3. 既存のTrack Logホーム画面ショートカット/インストール済みPWAを一度削除。
4. ブラウザを再読み込みして、改めて「アプリをインストール」または「ホーム画面に追加」。

既存のホーム画面アイコンはAndroid側が古いmanifest/アイコン情報を保持するため、Web側を更新しただけでは差し替わらない場合があります。
