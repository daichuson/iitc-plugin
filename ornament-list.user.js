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


// use own namespace for plugin
window.plugin.ornamentIcons = function () {};
// false にするとモーダルの「Anomaly Portal 1 (ap1) — 1件」見出しを非表示にします。
window.plugin.ornamentIcons.showAnomalyHeadings = false;

window.plugin.ornamentIcons.jsonUrl = 'https://iitc.app/extras/ornaments/definitions.json';
var NEARBY_DISTANCE_KM = 10;
// true: 距離を優先してまとめる。false: オーナメント種別ごとにまとめる（従来表示）。
var GROUP_BY_NEARBY_FIRST = true;

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
  var allPortals = [];
  var copyAllLines = [];
  var nearbyCopyTexts = [];

  function distanceKm(a, b) {
    var toRadians = function (degrees) { return degrees * Math.PI / 180; };
    var lat1 = toRadians(a.lat);
    var lat2 = toRadians(b.lat);
    var deltaLat = lat2 - lat1;
    var deltaLng = toRadians(b.lng - a.lng);
    var haversine = Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
      Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) * Math.sin(deltaLng / 2);
    return 6371 * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
  }

  // 10km以内のポータルを連結してグループ化します。
  function groupNearbyPortals(portals) {
    var remaining = portals.slice();
    var groups = [];
    while (remaining.length) {
      var group = [remaining.shift()];
      var changed = true;
      while (changed) {
        changed = false;
        for (var i = remaining.length - 1; i >= 0; i--) {
          if (group.some(function (member) {
            return distanceKm(member, remaining[i]) <= NEARBY_DISTANCE_KM;
          })) {
            group.push(remaining.splice(i, 1)[0]);
            changed = true;
          }
        }
      }
      groups.push(group);
    }
    return groups;
  }

  anomalyIds.forEach(function (id) {
    portalsByOrnament[id] = [];
  });

  Object.keys(window.portals || {}).forEach(function (guid) {
    var portal = window.portals[guid];
    var data = portal && portal.options && portal.options.data;
    if (!data || !Array.isArray(data.ornaments)) return;

    data.ornaments.forEach(function (id) {
      if (!portalsByOrnament[id]) return;
      if (typeof data.latE6 !== 'number' || typeof data.lngE6 !== 'number') return;
      var portalEntry = { name: data.title || guid, guid: guid, lat: data.latE6 / 1e6, lng: data.lngE6 / 1e6, ornamentId: id };
      portalsByOrnament[id].push(portalEntry);
      allPortals.push(portalEntry);
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

    if (GROUP_BY_NEARBY_FIRST) {
      var nearbyGroups = groupNearbyPortals(allPortals);
      nearbyGroups.forEach(function (group, groupIndex) {
        var groupItem = document.createElement('li');
        var groupTitle = document.createElement('div');
        var uniquePortalCount = group.reduce(function (count, portal, index) {
          return count + (group.findIndex(function (entry) { return entry.guid === portal.guid; }) === index ? 1 : 0);
        }, 0);
        groupTitle.textContent = '近隣グループ ' + (groupIndex + 1) + '（' + uniquePortalCount + '件）';
        groupItem.appendChild(groupTitle);

        var byOrnament = {};
        group.forEach(function (portal) {
          if (!byOrnament[portal.ornamentId]) byOrnament[portal.ornamentId] = [];
          byOrnament[portal.ornamentId].push(portal);
        });
        var groupLines = [];
        Object.keys(byOrnament).sort().forEach(function (id) {
          var ornamentPortals = byOrnament[id];
          var definition = window.ornaments.icon && window.ornaments.icon[id];
          var ornamentHeading = document.createElement('div');
          ornamentHeading.textContent = (definition && definition.name ? definition.name : id) + ' (' + id + ') — ' + ornamentPortals.length + '件';
          if (window.plugin.ornamentIcons.showAnomalyHeadings) {
            groupItem.appendChild(ornamentHeading);
            groupLines.push(ornamentHeading.textContent);
          }
          ornamentPortals.forEach(function (portal) {
            var link = 'https://link.ingress.com/portal/' + portal.guid;
            copyAllLines.push('  - ' + portal.name, link, '');
            groupLines.push('  - ' + portal.name, link);
            var portalItem = document.createElement('div');
            var name = document.createElement('span');
            name.textContent = '- ' + portal.name + ' ';
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
            groupItem.appendChild(portalItem);
          });
        });
        var groupCopyIndex = nearbyCopyTexts.length;
        nearbyCopyTexts.push(groupLines.join('\n'));
        var groupCopyButton = document.createElement('button');
        groupCopyButton.type = 'button';
        groupCopyButton.className = 'ornament-copy-nearby-group';
        groupCopyButton.dataset.copyIndex = groupCopyIndex;
        groupCopyButton.textContent = 'この近隣グループをコピー';
        groupItem.appendChild(groupCopyButton);
        var groupStatus = document.createElement('span');
        groupStatus.className = 'ornament-copy-nearby-status';
        groupStatus.style.marginLeft = '5px';
        groupItem.appendChild(groupStatus);
        list.appendChild(groupItem);
      });
    } else anomalyIds.forEach(function (id) {
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
        var groups = groupNearbyPortals(portalNames);
        groups.forEach(function (group, groupIndex) {
          var groupItem = document.createElement('li');
          var groupTitle = document.createElement('div');
          groupTitle.textContent = '近隣グループ ' + (groupIndex + 1) + '（' + group.length + '件）';
          groupItem.appendChild(groupTitle);

          var groupLines = [];
          group.forEach(function (portal) {
            var link = 'https://link.ingress.com/portal/' + portal.guid;
            copyAllLines.push('  - ' + portal.name, link, '');
            groupLines.push(portal.name, link, '');
            var portalItem = document.createElement('div');
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
            groupItem.appendChild(portalItem);
          });

          var groupCopyIndex = nearbyCopyTexts.length;
          nearbyCopyTexts.push(groupLines.join('\n'));
          var groupCopyButton = document.createElement('button');
          groupCopyButton.type = 'button';
          groupCopyButton.className = 'ornament-copy-nearby-group';
          groupCopyButton.dataset.copyIndex = groupCopyIndex;
          groupCopyButton.textContent = 'この近隣グループをコピー';
          groupItem.appendChild(groupCopyButton);
          var groupStatus = document.createElement('span');
          groupStatus.className = 'ornament-copy-nearby-status';
          groupStatus.style.marginLeft = '5px';
          groupItem.appendChild(groupStatus);
          portalList.appendChild(groupItem);
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
  Array.prototype.forEach.call(dialog.querySelectorAll('.ornament-copy-nearby-group'), function (button) {
    button.addEventListener('click', function () {
      var status = button.parentNode.querySelector('.ornament-copy-nearby-status');
      if (!navigator.clipboard || !navigator.clipboard.writeText) {
        status.textContent = 'クリップボードを利用できません';
        return;
      }
      navigator.clipboard.writeText(nearbyCopyTexts[Number(button.dataset.copyIndex)]).then(function () {
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
