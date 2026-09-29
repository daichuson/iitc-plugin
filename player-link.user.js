// ==UserScript==
// @author         dai02
// @name           IITC addon player-link
// @category       addon
// @version        0.1.0
// @description    スマートフォンのとき、nickname(ユーザー名)をタップするとエージェントのリンクページ(link.ingress.com)に遷移します
// @id             player-link
// @match          https://intel.ingress.com/*
// @match          https://intel-x.ingress.com/*
// @match          https://*.ingress.com/intel*
// @match          http://*.ingress.com/intel*
// @match          https://intel.ingress.com/
// @match          http://intel.ingress.com/
// @match          https://*.ingress.com/mission/*
// @match          http://*.ingress.com/mission/*
// @grant          none
// ==/UserScript==

function wrapper(plugin_info) {
    // ensure plugin framework is there, even if iitc is not yet loaded
    if (typeof window.plugin !== 'function') window.plugin = () => {};

    // use own namespace for plugin
    const self = window.plugin.playerLink = () => {};
    self.id = 'playerLink';
    self.title = 'IITC addon player-link';
    self.version = '0.1.0';
    self.author = 'dai02';

    self.BASE_URL = 'https://link.ingress.com/?link=https://intel.ingress.com/agent/';

    // スマートフォン判定
    // IITC本体の isSmartphone() があればそれを使い、無ければ UserAgent で判定
    self.isSmartphone = () => {
        try {
            if (typeof window.isSmartphone === 'function') return !!window.isSmartphone();
        } catch (e) { /* fallthrough */ }
        return /Android.*Mobile|iPhone|iPod|Windows Phone|IEMobile|Mobile.*Firefox/i.test(navigator.userAgent);
    };

    // nickname要素からユーザー名を取り出す (チャットの @ 付きにも対応)
    self.getNickname = (element) => {
        return (element.textContent || '').trim().replace(/^@/, '');
    };

    self.openPlayerLink = (nickname) => {
        const url = self.BASE_URL + encodeURIComponent(nickname);
        const opened = window.open(url, '_blank');
        if (!opened) window.location.href = url; // ポップアップ扱いでブロックされた場合
    };

    // IITC本体の nickname クリック処理(チャット入力へ @名前 を挿入)より先に処理するため、
    // キャプチャフェーズで受け取って伝播を止める
    self.onClick = (e) => {
        if (!self.isSmartphone()) return;

        const target = e.target;
        if (!target || typeof target.closest !== 'function') return;
        const element = target.closest('.nickname');
        if (!element) return;

        const nickname = self.getNickname(element);
        if (!nickname) return;

        e.preventDefault();
        e.stopImmediatePropagation();
        self.openPlayerLink(nickname);
    };

    self.setup = () => {
        if ('pluginloaded' in self) {
            console.log(`IITC plugin already loaded: ${self.title} version ${self.version}`);
            return;
        }
        self.pluginloaded = true;

        window.addEventListener('click', self.onClick, true);

        // nickname がタップできると分かるようにカーソルだけ変更
        const stylesheet = document.head.appendChild(document.createElement('style'));
        stylesheet.innerHTML = `
@media (hover: none) and (pointer: coarse) {
    .nickname { cursor: pointer; text-decoration: underline; }
}
`;

        console.log(`IITC plugin loaded: ${self.title} version ${self.version}`);
    };

    const setup = () => {
        if (window.iitcLoaded) {
            self.setup();
        } else {
            window.addHook('iitcLoaded', self.setup);
        }
    };

    setup.info = plugin_info; // add the script info data to the function as a property
    if (!window.bootPlugins) window.bootPlugins = [];
    window.bootPlugins.push(setup);
    // if IITC has already booted, immediately run the 'setup' function
    if (window.iitcLoaded && typeof setup === 'function') setup();
} // wrapper end

// inject code into site context
var script = document.createElement('script');
var info = {};
if (typeof GM_info !== 'undefined' && GM_info && GM_info.script) info.script = { version: GM_info.script.version, name: GM_info.script.name, description: GM_info.script.description };
script.appendChild(document.createTextNode('(' + wrapper + ')(' + JSON.stringify(info) + ');'));
(document.body || document.head || document.documentElement).appendChild(script);