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
window.plugin.ornamentIcons.showAnomalyHeadings = true;

window.plugin.ornamentIcons.jsonUrl = 'https://iitc.app/extras/ornaments/definitions.json';
var NEARBY_DISTANCE_KM = 10;
// true: 距離を優先してまとめる。false: オーナメント種別ごとにまとめる（従来表示）。
var GROUP_BY_NEARBY_FIRST = false;
var artifactListDialogOpen = false;
var artifactListRefreshPending = false;

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
  var existingDialog = window.DIALOGS && window.DIALOGS['dialog-anomalyOrnaments'];
  var savedDialogPosition = null;
  if (existingDialog) {
    savedDialogPosition = $(existingDialog).dialog('option', 'position');
  }

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

  // 現在の地図表示範囲にあるShardポータルを、IITCのArtifactデータから一覧化します。
  var artifactSection = document.createElement('section');
  artifactSection.style.marginBottom = '12px';
  var artifactHeading = document.createElement('h3');
  artifactHeading.textContent = 'Artifact (Shard)';
  artifactSection.appendChild(artifactHeading);
  var artifact = window.artifact;
  var artifactPortalInfo = artifact && artifact.portalInfo || {};
  // Artifact type names change between events (for example, Alpha shards),
  // so use the current type registry and identify shard records by fragments.
  var shardTypes = artifact && artifact.artifactTypes
    ? Object.keys(artifact.artifactTypes)
    : [];
  var visibleShardPortals = {};
  var mapBounds = window.map && window.map.getBounds ? window.map.getBounds() : null;

  Object.keys(artifactPortalInfo).forEach(function (guid) {
    var info = artifactPortalInfo[guid];
    var data = info && info._data;
    if (!data || typeof data.latE6 !== 'number' || typeof data.lngE6 !== 'number') return;
    var latlng = { lat: data.latE6 / 1e6, lng: data.lngE6 / 1e6 };
    if (mapBounds && !mapBounds.contains([latlng.lat, latlng.lng])) return;

    var shardInfo = null;
    shardTypes.some(function (type) {
      if (!Object.prototype.hasOwnProperty.call(info, type)) return false;
      // portalInfo is the summary index. Shard records have a truthy
      // fragments value; detailed fragment numbers come from portalDetail.
      if (!info[type] || !info[type].fragments) return false;
      shardInfo = info[type];
      return true;
    });
    if (shardInfo) {
      var detail = window.portalDetail && window.portalDetail.get ? window.portalDetail.get(guid) : null;
      // Match the artifact modal: request portal detail when the cached detail
      // is missing or stale; fragment numbers arrive through portalDetail.
      if (window.portalDetail && window.portalDetail.request &&
          (!window.portalDetail.isFresh || !window.portalDetail.isFresh(guid))) {
        window.portalDetail.request(guid);
      }
      var fragments = detail && detail.artifactDetail && detail.artifactDetail.fragments;
      visibleShardPortals[guid] = {
        guid: guid,
        data: data,
        shardInfo: shardInfo,
        fragments: Array.isArray(fragments) ? fragments : null,
        latlng: latlng,
      };
    }
  });

  var shardPortals = Object.keys(visibleShardPortals).map(function (guid) { return visibleShardPortals[guid]; });
  function firstShardNumber(portal) {
    if (!portal.fragments || !portal.fragments.length) return Number.POSITIVE_INFINITY;
    return portal.fragments.reduce(function (smallest, fragment) {
      var number = Number(fragment);
      return Number.isFinite(number) && number < smallest ? number : smallest;
    }, Number.POSITIVE_INFINITY);
  }
  function shardLabel(portal) {
    if (!portal.fragments || !portal.fragments.length) return '取得中';
    return portal.fragments.map(function (fragment) { return '#' + fragment; }).join(', ');
  }
  if (shardPortals.length) {
    var copyAllShardButton = document.createElement('button');
    copyAllShardButton.type = 'button';
    copyAllShardButton.className = 'ornament-copy-all-shards';
    copyAllShardButton.textContent = 'Shardポータル一覧をコピー';
    artifactSection.appendChild(copyAllShardButton);
    var copyAllShardStatus = document.createElement('span');
    copyAllShardStatus.className = 'ornament-copy-all-shards-status';
    copyAllShardStatus.style.marginLeft = '5px';
    if (shardPortals.some(function (portal) { return !portal.fragments || !portal.fragments.length; })) {
      copyAllShardStatus.textContent = 'Shard情報を取得中';
    }
    artifactSection.appendChild(copyAllShardStatus);

    var shardList = document.createElement('ul');
    shardPortals.sort(function (a, b) {
      var numberDifference = firstShardNumber(a) - firstShardNumber(b);
      if (numberDifference) return numberDifference;
      return String(a.data.title || '').localeCompare(String(b.data.title || ''));
    });
    shardPortals.forEach(function (portal) {
      var item = document.createElement('li');
      var portalName = portal.data.title || portal.guid;
      var label = document.createElement('span');
      label.textContent = shardLabel(portal) + ' : ' + portalName + ' ';
      item.appendChild(label);
      var copyButton = document.createElement('button');
      copyButton.type = 'button';
      copyButton.className = 'ornament-copy-shard-portal';
      copyButton.dataset.portalName = portal.data.title || portal.guid;
      copyButton.dataset.portalGuid = portal.guid;
      copyButton.dataset.shardLabel = shardLabel(portal);
      copyButton.textContent = 'Copy PortalLink';
      item.appendChild(copyButton);
      var copyStatus = document.createElement('span');
      copyStatus.className = 'ornament-copy-shard-portal-status';
      copyStatus.style.marginLeft = '5px';
      item.appendChild(copyStatus);
      shardList.appendChild(item);
    });
    artifactSection.appendChild(shardList);
  } else {
    var noShards = document.createElement('div');
    noShards.textContent = artifact
      ? 'Shardポータルはありません。'
      : 'Artifact情報を取得できません。';
    artifactSection.appendChild(noShards);
  }
  content.appendChild(artifactSection);

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

  function sortGroupsByLongitude(groups) {
    function meanLongitude(group) {
      var longitudeSin = 0;
      var longitudeCos = 0;
      group.forEach(function (portal) {
        var longitudeRadians = portal.lng * Math.PI / 180;
        longitudeSin += Math.sin(longitudeRadians);
        longitudeCos += Math.cos(longitudeRadians);
      });
      return Math.atan2(longitudeSin, longitudeCos) * 180 / Math.PI;
    }
    groups.sort(function (a, b) {
      return meanLongitude(b) - meanLongitude(a);
    });
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

  var ornamentsSection = document.createElement('section');
  ornamentsSection.style.marginTop = '12px';
  var ornamentsHeading = document.createElement('h3');
  ornamentsHeading.textContent = 'Ornaments';
  ornamentsSection.appendChild(ornamentsHeading);

  if (anomalyIds.length === 0) {
    var noOrnaments = document.createElement('div');
    noOrnaments.textContent = '該当ポータルなし';
    ornamentsSection.appendChild(noOrnaments);
    content.appendChild(ornamentsSection);
  } else {
    var totalOrnamentPortals = allPortals.length;
    if (totalOrnamentPortals === 0) {
      var noOrnamentPortals = document.createElement('div');
      noOrnamentPortals.textContent = '該当ポータルなし';
      ornamentsSection.appendChild(noOrnamentPortals);
      content.appendChild(ornamentsSection);
    } else {
      var list = document.createElement('ul');
      var summary = '';
      // var summary = '取得済み: ' + anomalyIds.length + '種類（現在読み込まれているポータルから集計）';
      ornamentsSection.appendChild(document.createTextNode(summary));
      copyAllLines.push(summary);

      var copyAllButton = document.createElement('button');
      copyAllButton.type = 'button';
      copyAllButton.className = 'ornament-copy-all-list';
      copyAllButton.textContent = '一覧をコピー';
      copyAllButton.style.marginLeft = '8px';
      ornamentsSection.appendChild(copyAllButton);

      var copyAllStatus = document.createElement('span');
      copyAllStatus.className = 'ornament-copy-all-status';
      copyAllStatus.style.marginLeft = '5px';
      ornamentsSection.appendChild(copyAllStatus);

    if (GROUP_BY_NEARBY_FIRST) {
      var nearbyGroups = sortGroupsByLongitude(groupNearbyPortals(allPortals));
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
        var groups = sortGroupsByLongitude(groupNearbyPortals(portalNames));
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
        var unavailable = document.createElement('div');
        unavailable.textContent = '該当ポータルはありません。';
        item.appendChild(unavailable);
      }
      list.appendChild(item);
    });
      ornamentsSection.appendChild(list);
      content.appendChild(ornamentsSection);
    }
  }


  artifactListDialogOpen = true;
  window.dialog({
    id: 'anomalyOrnaments',
    title: '取得済みAnomalyオーナメント',
    html: content.outerHTML,
    position: savedDialogPosition || { my: 'center top', at: 'center top+50', of: window, collision: 'fit' },
    buttons: [
      {
        text: '更新',
        css: { float: 'left', 'margin-right': '2px' },
        click: function () {
          window.plugin.ornamentIcons.showAnomalyList();
        },
      },
      {
        text: '閉じる',
        click: function () {
          artifactListDialogOpen = false;
          $(this).dialog('close');
        },
      },
    ],
  });

  var dialog = window.DIALOGS && window.DIALOGS['dialog-anomalyOrnaments'];
  if (!dialog) return;
  if (savedDialogPosition) {
    $(dialog).dialog('option', 'position', savedDialogPosition);
  }
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
  var copyAllShardButtonInDialog = dialog.querySelector('.ornament-copy-all-shards');
  if (copyAllShardButtonInDialog) {
    copyAllShardButtonInDialog.addEventListener('click', function () {
      var status = dialog.querySelector('.ornament-copy-all-shards-status');
      if (!navigator.clipboard || !navigator.clipboard.writeText) {
        status.textContent = 'クリップボードを利用できません';
        return;
      }
      var lines = Array.prototype.map.call(dialog.querySelectorAll('.ornament-copy-shard-portal'), function (button) {
        return button.dataset.shardLabel + ' : ' + button.dataset.portalName + '\nhttps://link.ingress.com/portal/' + button.dataset.portalGuid;
      });
      navigator.clipboard.writeText(lines.join('\n\n')).then(function () {
        showCopySuccess(status);
      }, function () {
        status.textContent = 'コピーに失敗しました';
      });
    });
  }
  Array.prototype.forEach.call(dialog.querySelectorAll('.ornament-copy-shard-portal'), function (button) {
    button.addEventListener('click', function () {
      var status = button.parentNode.querySelector('.ornament-copy-shard-portal-status');
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

// Artifact portal details arrive asynchronously. Rebuild the open list after
// each detail load so its Shard numbers and numeric ordering become visible.
if (window.addHook) {
  window.addHook('portalDetailLoaded', function () {
    var openDialog = window.DIALOGS && window.DIALOGS['dialog-anomalyOrnaments'];
    if (artifactListDialogOpen && (!openDialog || !$(openDialog).dialog('isOpen'))) {
      artifactListDialogOpen = false;
    }
    if (!artifactListDialogOpen || artifactListRefreshPending) return;
    artifactListRefreshPending = true;
    window.setTimeout(function () {
      artifactListRefreshPending = false;
      if (artifactListDialogOpen) window.plugin.ornamentIcons.showAnomalyList();
    }, 0);
  });
}

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
