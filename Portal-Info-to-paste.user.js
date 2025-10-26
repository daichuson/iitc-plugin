// ==UserScript==
// @id             portal-info-to-paste
// @name           IITC plugin: Portal Info to paste
// @category       Portal Info
// @version        1.0.0
// @description    make it easy to copy and paste portal name and intel url
// @include        https://*.ingress.com/intel*
// @include        http://*.ingress.com/intel*
// @match          https://*.ingress.com/intel*
// @match          http://*.ingress.com/intel*
// @match          https://intel.ingress.com/
// @match          http://intel.ingress.com/
// @grant          none
// ==/UserScript==

function wrapper(plugin_info) {
  if (typeof window.plugin !== 'function') window.plugin = function () { };

  // PLUGIN START ////////////////////////////////////////////////////////
  window.plugin.thanks4lmfyp = function () { };

  window.plugin.thanks4lmfyp.portalDetail = function (data) {
    $('#thanks4lmfyp').remove();

    var title = data.portalData.title;
    var guid = data.guid;
    var pdetails = portalDetail.get(guid);
    // var owner = pdetails.owner;
    var name = escapeJavascriptString(title);

    if (pdetails) {
      data = getPortalSummaryData(pdetails);
    }

    // 旧形式のurl
    // var url = "https://link.ingress.com/?link=https%3A%2F%2Fintel.ingress.com%2Fportal%2F" + guid + "&apn=com.nianticproject.ingress&isi=576505181&ibi=com.google.ingress&ifl=https%3A%2F%2Fapps.apple.com%2Fapp%2Fingress%2Fid576505181" + "&ofl=https%3a%2f%2fintel.ingress.com%2fintel%3fpll%3d" + lat +","+ lng;
    var url = "https://link.ingress.com/portal/" + guid;

    var copiedtext = name + "\\n" + url;

    // コピーボタン
    $('.linkdetails').append("<button onclick='navigator.clipboard.writeText(\"" + copiedtext + "\");document.getElementById(\"message\").textContent=\"コピーしました!\"' >ダイナミックリンクコピー</button><p id='message'></p>");
    // テキストボックス
    // $('.linkdetails').append('<textarea id="thanks4lmfyp" name="thanks4lmfyp" onclick="javascript:this.focus();this.select()" >' + copiedtext + '</textarea>');
  }

  var setup = function () {
    // $('<style>').prop('type', 'text/css').html('#thanks4lmfyp {display: block; width: 100%; height: 3em; margin: 5px;}').appendTo('head');
    window.addHook('portalDetailsUpdated', window.plugin.thanks4lmfyp.portalDetail);
  }

  // PLUGIN END //////////////////////////////////////////////////////////

  setup.info = plugin_info; //add the script info data to the function as a property
  if (!window.bootPlugins) window.bootPlugins = [];
  window.bootPlugins.push(setup);
  // if IITC has already booted, immediately run the 'setup' function
  if (window.iitcLoaded && typeof setup === 'function') setup();
} // wrapper end


var script = document.createElement('script');
var info = {};
if (typeof GM_info !== 'undefined' && GM_info && GM_info.script) info.script = { version: GM_info.script.version, name: GM_info.script.name, description: GM_info.script.description };
script.appendChild(document.createTextNode('(' + wrapper + ')(' + JSON.stringify(info) + ');'));
(document.body || document.head || document.documentElement).appendChild(script);

