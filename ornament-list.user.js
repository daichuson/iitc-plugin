// ==UserScript==
// @author         dai02
// @name           IITC plugin: Ornament List
// @category       Layer
// @version        0.0.1
// @description    Add own icons and names for ornaments
// @id             ornament-List
// @match          https://intel.ingress.com/*
// @match          http://intel.ingress.com/*
// @match          https://intel-x.ingress.com/*
// @match          https://*.ingress.com/intel*
// @match          http://*.ingress.com/intel*
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

  var showTemporaryStatus = function (status, message) {
    var section = status;
    while (section && section.tagName !== 'SECTION') section = section.parentNode;
    var target = section && section.querySelector('.ornament-section-status');
    if (!target) target = status;
    window.clearTimeout(target.ornamentStatusTimer);
    target.textContent = message;
    target.ornamentStatusTimer = window.setTimeout(function () {
      target.textContent = '';
    }, 5000);
  };
  var showCopySuccess = function (status) {
    showTemporaryStatus(status, 'コピーしました');
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
  var battleCopyLines = [];

  // 現在の地図表示範囲にあるShardポータルを、IITCのArtifactデータから一覧化します。
  var artifactSection = document.createElement('section');
  artifactSection.style.marginBottom = '12px';
  var artifactHeading = document.createElement('h3');
  artifactHeading.textContent = 'Artifact (Shard)';
  artifactSection.appendChild(artifactHeading);
  var artifactStatus = document.createElement('div');
  artifactStatus.className = 'ornament-section-status';
  artifactSection.appendChild(artifactStatus);
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
      var artifactName = detail && detail.artifactDetail && detail.artifactDetail.displayName;
      visibleShardPortals[guid] = {
        guid: guid,
        data: data,
        shardInfo: shardInfo,
        fragments: Array.isArray(fragments) ? fragments : null,
        artifactName: typeof artifactName === 'string' ? artifactName : null,
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
    var fragmentLabels = portal.fragments.map(function (fragment) { return '#' + fragment; }).join(', ');
    return portal.artifactName ? portal.artifactName + ' ' + fragmentLabels : fragmentLabels;
  }
  function createInventoryKeyButton(listType) {
    var keyButton = document.createElement('button');
    keyButton.type = 'button';
    keyButton.className = 'ornament-copy-inventory-keys';
    keyButton.dataset.listType = listType;
    keyButton.textContent = '所持キーコピー';
    var keyStatus = document.createElement('span');
    keyStatus.className = 'ornament-copy-inventory-keys-status';
    keyStatus.style.marginLeft = '5px';
    return { button: keyButton, status: keyStatus };
  }
  function createPortalDetailsLink(portal) {
    var link = document.createElement('a');
    link.href = '#';
    link.className = 'ornament-portal-details-link';
    link.dataset.portalGuid = portal.guid;
    link.dataset.portalLat = portal.lat;
    link.dataset.portalLng = portal.lng;
    link.textContent = portal.name;
    return link;
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
    var shardKeyCopy = createInventoryKeyButton('shards');
    shardKeyCopy.button.style.marginLeft = '8px';
    artifactSection.appendChild(shardKeyCopy.button);
    artifactSection.appendChild(shardKeyCopy.status);

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
      label.appendChild(document.createTextNode(shardLabel(portal) + ' : '));
      label.appendChild(createPortalDetailsLink({
        name: portalName,
        guid: portal.guid,
        lat: portal.latlng.lat,
        lng: portal.latlng.lng,
      }));
      label.appendChild(document.createTextNode(' '));
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
    // Battle VERY_RARE / RARE ornaments can appear alongside the six AP
    // ornaments. Include only AP ornament entries from those same portals.
    if (data.ornaments.indexOf('peBB_Battle_VERY_RARE') !== -1 ||
        data.ornaments.indexOf('peBB_Battle_RARE') !== -1) {
      data.ornaments.forEach(function (id) {
        if (!/^ap[123](?:_v)?$/.test(id)) return;
        if (typeof data.latE6 !== 'number' || typeof data.lngE6 !== 'number') return;
        battleCopyLines.push({
          name: data.title || guid,
          guid: guid,
          ornamentId: id,
        });
      });
    }
  });

  var inventoryKeys = window.plugin && window.plugin.playerInventory &&
    window.plugin.playerInventory.inventory && window.plugin.playerInventory.inventory.keys;
  if (inventoryKeys && typeof inventoryKeys.get === 'function') {
    battleCopyLines = battleCopyLines.filter(function (portal) {
      return !!inventoryKeys.get(portal.guid);
    });
  } else {
    battleCopyLines = [];
  }

  var ornamentsSection = document.createElement('section');
  ornamentsSection.style.marginTop = '12px';
  var ornamentsHeading = document.createElement('h3');
  ornamentsHeading.textContent = 'Ornaments';
  ornamentsSection.appendChild(ornamentsHeading);
  var ornamentsStatus = document.createElement('div');
  ornamentsStatus.className = 'ornament-section-status';
  ornamentsSection.appendChild(ornamentsStatus);

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
      var ornamentKeyCopy = createInventoryKeyButton('ornaments');
      ornamentKeyCopy.button.style.marginLeft = '8px';
      ornamentsSection.appendChild(ornamentKeyCopy.button);
      ornamentsSection.appendChild(ornamentKeyCopy.status);
      if (battleCopyLines.length) {
        var battleCopyButton = document.createElement('button');
        battleCopyButton.type = 'button';
        battleCopyButton.className = 'ornament-copy-battle-ap';
        battleCopyButton.textContent = 'Battle付きコピー';
        battleCopyButton.style.marginLeft = '8px';
        ornamentsSection.appendChild(battleCopyButton);
        var battleCopyStatus = document.createElement('span');
        battleCopyStatus.className = 'ornament-copy-battle-ap-status';
        battleCopyStatus.style.marginLeft = '5px';
        ornamentsSection.appendChild(battleCopyStatus);
      }

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
        var groupCopyIndex = nearbyCopyTexts.length;
        var groupLines = [];
        nearbyCopyTexts.push('');
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
        var groupKeyCopy = createInventoryKeyButton('nearby-group');
        groupKeyCopy.button.style.marginLeft = '8px';
        groupItem.appendChild(groupKeyCopy.button);
        groupItem.appendChild(groupKeyCopy.status);

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
            portalItem.appendChild(document.createTextNode('- '));
            portalItem.appendChild(createPortalDetailsLink(portal));
            portalItem.appendChild(document.createTextNode(' '));
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
        nearbyCopyTexts[groupCopyIndex] = groupLines.join('\n');
        list.appendChild(groupItem);
      });
    } else anomalyIds.forEach(function (id) {
      var item = document.createElement('li');
      var definition = window.ornaments.icon && window.ornaments.icon[id];
      var portalNames = portalsByOrnament[id];
      var heading = document.createElement('div');
      heading.textContent = (definition && definition.name ? definition.name + ' ' : '') + '(' + id + ') — ' + portalNames.length + '件';
      if (!window.plugin.ornamentIcons.showAnomalyHeadings) heading.textContent = '';
      item.appendChild(heading);

      if (portalNames.length) {
        var portalList = document.createElement('ul');
        var groups = sortGroupsByLongitude(groupNearbyPortals(portalNames));
        var anomalyGroupCopyIndex = nearbyCopyTexts.length;
        var anomalyGroupLines = [];
        nearbyCopyTexts.push('');
        var anomalyGroupCopyButton = document.createElement('button');
        anomalyGroupCopyButton.type = 'button';
        anomalyGroupCopyButton.className = 'ornament-copy-nearby-group';
        anomalyGroupCopyButton.dataset.copyIndex = anomalyGroupCopyIndex;
        anomalyGroupCopyButton.textContent = 'グループ';
        anomalyGroupCopyButton.style.marginLeft = '8px';
        heading.appendChild(anomalyGroupCopyButton);
        var anomalyGroupStatus = document.createElement('span');
        anomalyGroupStatus.className = 'ornament-copy-nearby-status';
        anomalyGroupStatus.style.marginLeft = '5px';
        heading.appendChild(anomalyGroupStatus);
        var anomalyKeyCopy = createInventoryKeyButton('anomaly-group');
        anomalyKeyCopy.button.textContent = '所持キー';
        anomalyKeyCopy.button.style.marginLeft = '8px';
        heading.appendChild(anomalyKeyCopy.button);
        heading.appendChild(anomalyKeyCopy.status);
        groups.forEach(function (group, groupIndex) {
          var groupItem = document.createElement('li');
          group.forEach(function (portal) {
            var link = 'https://link.ingress.com/portal/' + portal.guid;
            copyAllLines.push('  - ' + portal.name, link, '');
            anomalyGroupLines.push(portal.name, link, '');
            var portalItem = document.createElement('div');
            portalItem.appendChild(createPortalDetailsLink(portal));
            portalItem.appendChild(document.createTextNode(' '));

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
          portalList.appendChild(groupItem);
        });
        nearbyCopyTexts[anomalyGroupCopyIndex] = anomalyGroupLines.join('\n');
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
  Array.prototype.forEach.call(dialog.querySelectorAll('.ornament-portal-details-link'), function (link) {
    link.addEventListener('click', function (event) {
      event.preventDefault();
      if (typeof window.zoomToAndShowPortal === 'function') {
        window.zoomToAndShowPortal(link.dataset.portalGuid, [
          Number(link.dataset.portalLat),
          Number(link.dataset.portalLng),
        ]);
      }
    });
  });
  if (savedDialogPosition) {
    $(dialog).dialog('option', 'position', savedDialogPosition);
  }
  var copyAllButtonInDialog = dialog.querySelector('.ornament-copy-all-list');
  if (copyAllButtonInDialog) {
    copyAllButtonInDialog.addEventListener('click', function () {
      var status = dialog.querySelector('.ornament-copy-all-status');
      if (!navigator.clipboard || !navigator.clipboard.writeText) {
        showTemporaryStatus(status, 'クリップボードを利用できません');
        return;
      }
      navigator.clipboard.writeText(copyAllLines.join('\n')).then(function () {
        showCopySuccess(status);
      }, function () {
        showTemporaryStatus(status, 'コピーに失敗しました');
      });
    });
  }
  var battleCopyButtonInDialog = dialog.querySelector('.ornament-copy-battle-ap');
  if (battleCopyButtonInDialog) {
    battleCopyButtonInDialog.addEventListener('click', function () {
      var status = dialog.querySelector('.ornament-copy-battle-ap-status');
      if (!navigator.clipboard || !navigator.clipboard.writeText) {
        showTemporaryStatus(status, 'クリップボードを利用できません');
        return;
      }
      var lines = battleCopyLines.map(function (portal) {
        var definition = window.ornaments.icon && window.ornaments.icon[portal.ornamentId];
        var ornamentName = definition && definition.name ? definition.name : portal.ornamentId;
        return ornamentName + ' (' + portal.ornamentId + ') : ' + portal.name +
          '\nhttps://link.ingress.com/portal/' + portal.guid;
      });
      navigator.clipboard.writeText(lines.join('\n\n')).then(function () {
        showCopySuccess(status);
      }, function () {
        showTemporaryStatus(status, 'コピーに失敗しました');
      });
    });
  }
  var copyAllShardButtonInDialog = dialog.querySelector('.ornament-copy-all-shards');
  if (copyAllShardButtonInDialog) {
    copyAllShardButtonInDialog.addEventListener('click', function () {
      var status = dialog.querySelector('.ornament-copy-all-shards-status');
      if (!navigator.clipboard || !navigator.clipboard.writeText) {
        showTemporaryStatus(status, 'クリップボードを利用できません');
        return;
      }
      var lines = Array.prototype.map.call(dialog.querySelectorAll('.ornament-copy-shard-portal'), function (button) {
        return button.dataset.shardLabel + ' : ' + button.dataset.portalName + '\nhttps://link.ingress.com/portal/' + button.dataset.portalGuid;
      });
      navigator.clipboard.writeText(lines.join('\n\n')).then(function () {
        showCopySuccess(status);
      }, function () {
        showTemporaryStatus(status, 'コピーに失敗しました');
      });
    });
  }
  Array.prototype.forEach.call(dialog.querySelectorAll('.ornament-copy-shard-portal'), function (button) {
    button.addEventListener('click', function () {
      var status = button.parentNode.querySelector('.ornament-copy-shard-portal-status');
      if (!navigator.clipboard || !navigator.clipboard.writeText) {
        showTemporaryStatus(status, 'クリップボードを利用できません');
        return;
      }
      var copyText = button.dataset.portalName + '\nhttps://link.ingress.com/portal/' + button.dataset.portalGuid;
      navigator.clipboard.writeText(copyText).then(function () {
        showCopySuccess(status);
      }, function () {
        showTemporaryStatus(status, 'コピーに失敗しました');
      });
    });
  });
  Array.prototype.forEach.call(dialog.querySelectorAll('.ornament-copy-inventory-keys'), function (button) {
    button.addEventListener('click', function () {
      var status = button.nextElementSibling;
      var inventory = window.plugin && window.plugin.playerInventory && window.plugin.playerInventory.inventory;
      var keys = inventory && inventory.keys;
      if (!keys || typeof keys.get !== 'function') {
        showTemporaryStatus(status, '所持キーを取得できません（コピー失敗）');
        return;
      }
      if (!navigator.clipboard || !navigator.clipboard.writeText) {
        showTemporaryStatus(status, 'クリップボードを利用できません');
        return;
      }
      var portalSelector = button.dataset.listType === 'shards'
        ? '.ornament-copy-shard-portal'
        : '.ornament-copy-portal-link';
      var portalButtons = button.dataset.listType === 'nearby-group'
        ? button.parentNode.querySelectorAll(portalSelector)
        : button.dataset.listType === 'anomaly-group'
          ? button.parentNode.parentNode.querySelectorAll(portalSelector)
          : dialog.querySelectorAll(portalSelector);
      var copyLines = [];
      var missingKeys = 0;
      Array.prototype.forEach.call(portalButtons, function (portalButton) {
        var key = keys.get(portalButton.dataset.portalGuid);
        if (!key) {
          missingKeys++;
          return;
        }
        copyLines.push((key.title || portalButton.dataset.portalName) +
          '\n所持数: ' + key.total +
          '\nhttps://link.ingress.com/portal/' + key.guid);
      });
      if (!copyLines.length) {
        showTemporaryStatus(status, '該当する所持キーがありません（コピー失敗）');
        return;
      }
      navigator.clipboard.writeText(copyLines.join('\n\n')).then(function () {
        if (missingKeys) {
          showTemporaryStatus(status, 'コピーしました（所持キーなし: ' + missingKeys + '件）');
        } else {
          showCopySuccess(status);
        }
      }, function () {
        showTemporaryStatus(status, 'コピーに失敗しました');
      });
    });
  });
  Array.prototype.forEach.call(dialog.querySelectorAll('.ornament-copy-portal-link'), function (button) {
    button.addEventListener('click', function () {
      var status = button.parentNode.querySelector('.ornament-copy-portal-status');
      if (!navigator.clipboard || !navigator.clipboard.writeText) {
        showTemporaryStatus(status, 'クリップボードを利用できません');
        return;
      }
      var copyText = button.dataset.portalName + '\nhttps://link.ingress.com/portal/' + button.dataset.portalGuid;
      navigator.clipboard.writeText(copyText).then(function () {
        showCopySuccess(status);
      }, function () {
        showTemporaryStatus(status, 'コピーに失敗しました');
      });
    });
  });
  Array.prototype.forEach.call(dialog.querySelectorAll('.ornament-copy-nearby-group'), function (button) {
    button.addEventListener('click', function () {
      var status = button.parentNode.querySelector('.ornament-copy-nearby-status');
      if (!navigator.clipboard || !navigator.clipboard.writeText) {
        showTemporaryStatus(status, 'クリップボードを利用できません');
        return;
      }
      navigator.clipboard.writeText(nearbyCopyTexts[Number(button.dataset.copyIndex)]).then(function () {
        showCopySuccess(status);
      }, function () {
        showTemporaryStatus(status, 'コピーに失敗しました');
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

  if (window.useAppPanes && window.useAppPanes() && window.app && window.app.addPane) {
    window.app.addPane('plugin-ornament-list', 'Ornaments', 'ic_action_view_as_list');
    window.addHook('paneChanged', function (pane) {
      if (pane === 'plugin-ornament-list') {
        if (window.show) window.show('map');
        window.plugin.ornamentIcons.showAnomalyList();
      }
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
