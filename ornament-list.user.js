// ==UserScript==
// @author         dai02
// @name           IITC plugin: Ornament List
// @category       Layer
// @version        0.0.1
// @description    Add own icons and names for ornaments
// @id             ornament-List
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
if(typeof window.plugin !== 'function') window.plugin = function() {};

//PLUGIN AUTHORS: writing a plugin outside of the IITC build environment? if so, delete these lines!!
//(leaving them in place might break the 'About IITC' page or break update checks)
plugin_info.buildName = 'release';
plugin_info.dateTimeVersion = '2026-05-18-134158';
plugin_info.pluginId = 'ornament-icons';
//END PLUGIN AUTHORS NOTE

/* exported setup, changelog --eslint */

var changelog = [
  {
    version: '0.1.3',
    changes: ['Refactoring: fix eslint'],
  },
  {
    version: '0.1.2',
    changes: ['Version upgrade due to a change in the wrapper: plugin icons are now vectorized'],
  },
  {
    version: '0.1.1',
    changes: ['Version upgrade due to a change in the wrapper: added plugin icon'],
  },
];

/** ********************
// Added as part of the Ingress #Helios in 2014, ornaments
// are additional image overlays for portals.
// currently there are 6 known types of ornaments: ap$x$suffix
// - cluster portals (without suffix)
// - volatile portals (_v)
// - meeting points (_start)
// - finish points (_end)
//
// Beacons and Frackers were introduced at the launch of the Ingress
// ingame store on November 1st, 2015
// - Beacons (pe$TAG - $NAME) ie: 'peNIA - NIANTIC'
// - Frackers ('peFRACK')
// (there are 7 different colors for each of them)
//
// Ornament IDs are dynamic. NIANTIC might change them at any time without prior notice.
// New ornamnent IDs found on the map will be recorded and saved to knownOrnaments from
// which the Ornaments dialog will be filled with checked checkboxes.
// To exclude a set of ornaments, even if they have not yet shown up on the map, the user
// can add an entry to excludedOrnaments, which will compared (startsWith) to all known and
// future IDs. example: "ap" to exclude all Ornaments for anomalies (ap1, ap2, ap2_v)

      Known ornaments (as of July 2022)
      // anomaly
      ap1, ap2, ap3, ap4, ap5, ap6, ap7, ap8, ap9
      & variations with _v, _end, _start
      // various beacons
      peFRACK, peNIA, peNEMESIS, peTOASTY, peFW_ENL, peFW_RES, peBN_BLM
      // battle beacons
      peBB_BATTLE_RARE, peBB_BATTLE,
      // battle winner beacons
      peBN_ENL_WINNER, peBN_RES_WINNER, peBN_TIED_WINNER,
      peBN_ENL_WINNER-60, peBN_RES_WINNER-60, peBN_TIED_WINNER-60,
      // battle rewards CAT 1-6
      peBR_REWARD-10_125_38, peBR_REWARD-10_150_75, peBR_REWARD-10_175_113,
      peBR_REWARD-10_200_150, peBR_REWARD-10_225_188, peBR_REWARD-10_250_225,
      // shards
      peLOOK
      // scouting
      sc5_p        // volatile scouting portal
      // battle
      bb_s         // scheduled RareBattleBeacons
      // various beacons
      peFRACK      // Fracker beacon

  The icon object holds optional definitions for the ornaments an beacons.
  'ornamentID' : {
    name: 'meaningful name',     // shows up in dialog
    layer: 'name for the Layer', // shows up in layerchooser, optional, if not set
                                 // ornament will be in "Ornaments"
    url: 'url',                  // from which the image will be taken, optional,
                                 // 84x84px is default, if not set, stock images will be
                                 // used
    offset: [dx,dy],             // optional, shift the ornament vertically or horizontally by
                                 // dx*size and dy*size. negative values will shift down
                                 // and left. [0.5, 0] to place right above the portal.
                                 // default is [0, 0] (center)
    opacity: 0..1                // optional, default is 0.6
  }

**********************/

// use own namespace for plugin
window.plugin.ornamentIcons = function () {};
// false にするとモーダルの「Anomaly Portal 1 (ap1) — 1件」見出しを非表示にします。
window.plugin.ornamentIcons.showAnomalyHeadings = true;

window.plugin.ornamentIcons.jsonUrl = 'https://iitc.app/extras/ornaments/definitions.json';

// append or overwrite external definitions
window.plugin.ornamentIcons.setIcons = function (externalIconDefinitions) {
  const localIconDefinitions = {
    // give a name, leave layer to default, url and offset ([0, 0.5] to place above the portal)
    // 'peTOASTY': {
    //   name: 'TOASTY',
    //   offset: [0, 0.5],
    //   url: '##include_img:images/ornament-TOASTY.svg##' // replace "##" with single "@"
    // }
  };
  window.ornaments.icon = { ...window.ornaments.icon, ...externalIconDefinitions, ...localIconDefinitions };
};

window.plugin.ornamentIcons.showAnomalyList = function () {
  var showCopySuccess = function (status) {
    status.textContent = 'コピーしました';
    window.clearTimeout(status.copySuccessTimer);
    status.copySuccessTimer = window.setTimeout(function () {
      status.textContent = '';
    }, 5000);
  };
  var knownOrnaments = window.ornaments && window.ornaments.knownOrnaments;
  var anomalyIds = knownOrnaments ? Object.keys(knownOrnaments).filter(function (id) {
    return /^ap\d/.test(id);
  }).sort() : [];
  var content = document.createElement('div');
  var portalsByOrnament = {};
  var copyAllLines = [];

  anomalyIds.forEach(function (id) {
    portalsByOrnament[id] = [];
  });

  Object.keys(window.portals || {}).forEach(function (guid) {
    var portal = window.portals[guid];
    var data = portal && portal.options && portal.options.data;
    if (!data || !Array.isArray(data.ornaments)) return;

    data.ornaments.forEach(function (id) {
      if (!portalsByOrnament[id]) return;
      portalsByOrnament[id].push({ name: data.title || guid, guid: guid });
    });
  });

  if (anomalyIds.length === 0) {
    content.textContent = '取得済みのAnomalyオーナメントはありません。';
  } else {
    var list = document.createElement('ul');
    var summary = '';
    // var summary = '取得済み: ' + anomalyIds.length + '種類（現在読み込まれているポータルから集計）';
    content.appendChild(document.createTextNode(summary));
    copyAllLines.push(summary);

    var copyAllButton = document.createElement('button');
    copyAllButton.type = 'button';
    copyAllButton.className = 'ornament-copy-all-list';
    copyAllButton.textContent = '一覧をコピー';
    copyAllButton.style.marginLeft = '8px';
    content.appendChild(copyAllButton);

    var copyAllStatus = document.createElement('span');
    copyAllStatus.className = 'ornament-copy-all-status';
    copyAllStatus.style.marginLeft = '5px';
    content.appendChild(copyAllStatus);

    anomalyIds.forEach(function (id) {
      var item = document.createElement('li');
      var definition = window.ornaments.icon && window.ornaments.icon[id];
      var portalNames = portalsByOrnament[id];
      var heading = document.createElement('div');
      heading.textContent = (definition && definition.name ? definition.name + ' ' : '') + '(' + id + ') — ' + portalNames.length + '件';
      if (window.plugin.ornamentIcons.showAnomalyHeadings) {
        item.appendChild(heading);
      }

      if (portalNames.length) {
        var portalList = document.createElement('ul');
        portalNames.forEach(function (portal) {
          copyAllLines.push('  - ' + portal.name, '    https://link.ingress.com/portal/' + portal.guid);
          var portalItem = document.createElement('li');
          var name = document.createElement('span');
          name.textContent = portal.name + ' ';
          portalItem.appendChild(name);

          var copyButton = document.createElement('button');
          copyButton.type = 'button';
          copyButton.className = 'ornament-copy-portal-link';
          copyButton.dataset.portalName = portal.name;
          copyButton.dataset.portalGuid = portal.guid;
          copyButton.textContent = 'Copy PortalLink';
          portalItem.appendChild(copyButton);

          var status = document.createElement('span');
          status.className = 'ornament-copy-portal-status';
          status.style.marginLeft = '5px';
          portalItem.appendChild(status);
          portalList.appendChild(portalItem);
        });
        item.appendChild(portalList);
      } else {
        copyAllLines.push('  ポータル名を取得できていません（現在読み込まれている範囲に該当ポータルがありません）。');
        var unavailable = document.createElement('div');
        unavailable.textContent = 'ポータル名を取得できていません（現在読み込まれている範囲に該当ポータルがありません）。';
        item.appendChild(unavailable);
      }
      list.appendChild(item);
    });
    content.appendChild(list);
  }

  window.dialog({
    id: 'anomalyOrnaments',
    title: '取得済みAnomalyオーナメント',
    html: content.outerHTML,
    buttons: [{ text: '閉じる', click: function () { $(this).dialog('close'); } }],
  });

  var dialog = window.DIALOGS && window.DIALOGS['dialog-anomalyOrnaments'];
  if (!dialog) return;
  var copyAllButtonInDialog = dialog.querySelector('.ornament-copy-all-list');
  if (copyAllButtonInDialog) {
    copyAllButtonInDialog.addEventListener('click', function () {
      var status = dialog.querySelector('.ornament-copy-all-status');
      if (!navigator.clipboard || !navigator.clipboard.writeText) {
        status.textContent = 'クリップボードを利用できません';
        return;
      }
      navigator.clipboard.writeText(copyAllLines.join('\n')).then(function () {
        showCopySuccess(status);
      }, function () {
        status.textContent = 'コピーに失敗しました';
      });
    });
  }
  Array.prototype.forEach.call(dialog.querySelectorAll('.ornament-copy-portal-link'), function (button) {
    button.addEventListener('click', function () {
      var status = button.parentNode.querySelector('.ornament-copy-portal-status');
      if (!navigator.clipboard || !navigator.clipboard.writeText) {
        status.textContent = 'クリップボードを利用できません';
        return;
      }
      var copyText = button.dataset.portalName + '\nhttps://link.ingress.com/portal/' + button.dataset.portalGuid;
      navigator.clipboard.writeText(copyText).then(function () {
        showCopySuccess(status);
      }, function () {
        status.textContent = 'コピーに失敗しました';
      });
    });
  });
};

function setup() {
  if (window.IITC && window.IITC.toolbox) {
    window.IITC.toolbox.addButton({
      label: 'Anomaly ornaments',
      action: window.plugin.ornamentIcons.showAnomalyList,
    });
  }

  fetch(window.plugin.ornamentIcons.jsonUrl).then((response) => {
    response.json().then((data) => {
      window.plugin.ornamentIcons.setIcons(data.ornaments);
    });
  });
}

setup.info = plugin_info; //add the script info data to the function as a property
if (typeof changelog !== 'undefined') setup.info.changelog = changelog;
if(!window.bootPlugins) window.bootPlugins = [];
window.bootPlugins.push(setup);
// if IITC has already booted, immediately run the 'setup' function
if(window.iitcLoaded && typeof setup === 'function') setup();
} // wrapper end
// inject code into site context
var script = document.createElement('script');
var info = {};
if (typeof GM_info !== 'undefined' && GM_info && GM_info.script) info.script = { version: GM_info.script.version, name: GM_info.script.name, description: GM_info.script.description };
script.appendChild(document.createTextNode('('+ wrapper +')('+JSON.stringify(info)+');'));
(document.body || document.head || document.documentElement).appendChild(script);
