// ==UserScript==
// @author         dai02
// @name           IITC plugin: Missions URL List
// @category       Info
// @version        0.1.0
// @description    Paste mission URLs (https://link.ingress.com/mission/xxxx) and build a mission list, like MD List. Requires "IITC plugin: Missions".
// @id             missions-url-list
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
  if (typeof window.plugin !== 'function') window.plugin = function () { };

  //PLUGIN AUTHORS: writing a plugin outside of the IITC build environment? if so, delete these lines!!
  plugin_info.buildName = 'release';
  plugin_info.dateTimeVersion = '2026-09-26-000000';
  plugin_info.pluginId = 'missionsUrlList';
  //END PLUGIN AUTHORS NOTE

  /* exported setup, changelog --eslint */
  /* global IITC -- eslint */

  var changelog = [
    { version: '0.1.0', changes: ['Initial release'] },
  ];

  window.plugin.missionsUrlList = {
    // 貼り付けたURLから抽出したguid（表示順を維持）
    urlMissionGuids: [],
    // 一覧モーダルに現在表示しているミッション（一括コピー・Load details用）
    urlDisplayedMissions: [],
    // 入力欄のテキスト（モーダルを開き直しても残す）
    urlInputText: '',
    // 一覧モーダルの高さ状態（height: リサイズ後の外寸 / overhead: リスト以外の高さ）
    listDialogState: { height: null, overhead: 0 },

    // Missionsプラグイン本体への参照
    missionsPlugin: function () {
      return window.plugin.missions;
    },

    // https://link.ingress.com/mission/xxxx を1行ごとに抽出する（順序維持・重複除去）
    extractMissionGuidsFromText: function (text) {
      var seen = {};
      var guids = [];
      (text || '').split(/\r?\n/).forEach(function (line) {
        var m = line.match(/https?:\/\/link\.ingress\.com\/mission\/([0-9a-zA-Z._-]+)/);
        if (!m) return;
        var guid = m[1];
        if (seen[guid]) return;
        seen[guid] = true;
        guids.push(guid);
      });
      return guids;
    },

    // URL入力用モーダル（textarea + Show mission + Ok）
    showUrlInputDialog: function () {
      var self = this;
      var openDialog = window.DIALOGS['dialog-missionsUrlListInput'];

      if (!openDialog) {
        var topPosition = { my: 'center top', at: 'center top+50', of: window, collision: 'fit' };

        var box = document.createElement('div');

        var hint = box.appendChild(document.createElement('p'));
        hint.style.cssText = 'margin:0 0 4px 0;';
        hint.textContent = 'ミッションURL（https://link.ingress.com/mission/xxxx）を1行に1件ずつ貼り付けてください。';

        var textarea = box.appendChild(document.createElement('textarea'));
        textarea.id = 'mission_urllist_input';
        textarea.value = self.urlInputText;
        textarea.rows = 10;
        textarea.style.cssText = 'width:100%; box-sizing:border-box; resize:vertical;';
        textarea.addEventListener('input', function () {
          self.urlInputText = textarea.value;
        });

        var status = box.appendChild(document.createElement('p'));
        status.id = 'mission_urllist_input_status';

        window.dialog({
          id: 'missionsUrlListInput',
          html: box,
          height: 'auto',
          width: '400px',
          title: 'MissionList',
          position: topPosition,
          buttons: [
            {
              text: 'Show mission',
              click: function () {
                window.plugin.missionsUrlList.handleShowUrlMissions();
              },
            },
            {
              text: 'Ok',
              click: function () {
                $(this).dialog('close');
              },
            },
          ],
        });

        openDialog = window.DIALOGS['dialog-missionsUrlListInput'];
        $(openDialog).dialog('option', 'position', topPosition);
      } else {
        // 既に開いている場合は、入力値を復元する
        var existingTextarea = document.getElementById('mission_urllist_input');
        if (existingTextarea) existingTextarea.value = self.urlInputText;
      }
    },

    // 「Show mission」ボタン：テキストエリアの内容からミッション一覧を作り、一覧モーダルを表示する
    handleShowUrlMissions: function () {
      var textarea = document.getElementById('mission_urllist_input');
      var statusEl = document.getElementById('mission_urllist_input_status');
      var text = textarea ? textarea.value : this.urlInputText;
      this.urlInputText = text;

      var guids = this.extractMissionGuidsFromText(text);

      if (!guids.length) {
        if (statusEl) statusEl.textContent = '有効なミッションURLが見つかりませんでした';
        return;
      }

      if (statusEl) statusEl.textContent = '';
      this.urlMissionGuids = guids;
      this.showUrlMissionDialog(true);
    },

    // guid一覧から、キャッシュがあればその詳細を、無ければ仮のプレースホルダーを並べて返す
    buildUrlMissionList: function () {
      var mp = this.missionsPlugin();
      return this.urlMissionGuids.map(function (guid) {
        return (
          mp.getMissionCache(guid) || {
            guid: guid,
            title: guid,
            image: mp.missionTypeImages[0],
            ratingE6: 0,
            medianCompletionTimeMs: 0,
          }
        );
      });
    },

    // 一覧モーダル（MD Listと同じ下部ボタン構成：Clear / Copy all / Copy Detail / Copy CSV / Load details / Ok）
    showUrlMissionDialog: function (resetScroll) {
      var mp = this.missionsPlugin();
      var missions = this.buildUrlMissionList();
      this.urlDisplayedMissions = missions;

      var caption = 'MissionList (' + missions.length + ')';

      var wrapper = document.createElement('div');

      var status = wrapper.appendChild(document.createElement('p'));
      status.id = 'mission_urllist_status';

      var content;
      if (missions.length) {
        content = mp.renderMissionList(missions, true); // true: 貼り付け順を維持
        content.style.overflowY = 'auto'; // 一覧部分だけをスクロールさせる（高さはfitListDialogで設定）
      } else {
        content = document.createElement('div');
        content.textContent = '該当するミッションがありません';
      }
      content.className = 'plugin-mission-urllist-list';
      wrapper.appendChild(content);

      var openDialog = window.DIALOGS['dialog-missionsUrlListResult'];
      if (!openDialog) {
        var topPosition = { my: 'center top', at: 'center top+50', of: window, collision: 'fit' };

        window.dialog({
          id: 'missionsUrlListResult',
          html: '&nbsp;',
          height: 'auto',
          width: '400px',
          title: caption,
          position: topPosition,
          buttons: [
            {
              text: 'Clear',
              css: { float: 'left', 'margin-right': '2px' },
              click: function () {
                window.plugin.missionsUrlList.urlMissionGuids = [];
                window.plugin.missionsUrlList.showUrlMissionDialog(true);
              },
            },
            {
              text: 'Copy all',
              css: { float: 'left', 'margin-right': '2px' },
              click: function () {
                var self = window.plugin.missionsUrlList;
                var mp = self.missionsPlugin();
                var list = self.urlDisplayedMissions || [];
                var statusEl = document.getElementById('mission_urllist_status');

                if (!list.length) {
                  if (statusEl) statusEl.textContent = 'コピー対象がありません';
                  return;
                }
                if (!navigator.clipboard || !navigator.clipboard.writeText) {
                  if (statusEl) statusEl.textContent = 'error: clipboard API not available';
                  return;
                }

                var text = list
                  .map(function (m) {
                    return mp.getMissionCopyText(m);
                  })
                  .join('\n \n');

                navigator.clipboard.writeText(text).then(
                  function () {
                    if (statusEl) statusEl.textContent = 'done(Copy ALL: ' + list.length + ')';
                  },
                  function (err) {
                    console.log('fail: ' + err);
                    if (statusEl) statusEl.textContent = 'error: ' + err;
                  }
                );
              },
            },
            {
              text: 'Copy Detail',
              css: { float: 'left', 'margin-right': '2px' },
              click: function () {
                var self = window.plugin.missionsUrlList;
                var mp = self.missionsPlugin();
                var list = self.urlDisplayedMissions || [];
                var statusEl = document.getElementById('mission_urllist_status');

                if (!list.length) {
                  if (statusEl) statusEl.textContent = 'コピー対象がありません';
                  return;
                }
                if (!navigator.clipboard || !navigator.clipboard.writeText) {
                  if (statusEl) statusEl.textContent = 'error: clipboard API not available';
                  return;
                }

                var text = list
                  .map(function (m) {
                    return mp.getMissionCopyText(m, true);
                  })
                  .join('\n \n');

                navigator.clipboard.writeText(text).then(
                  function () {
                    if (statusEl) statusEl.textContent = 'done(Copy Detail: ' + list.length + ')';
                  },
                  function (err) {
                    console.log('fail: ' + err);
                    if (statusEl) statusEl.textContent = 'error: ' + err;
                  }
                );
              },
            },
            {
              text: 'Copy CSV',
              css: { float: 'left', 'margin-right': '2px' },
              click: function () {
                var self = window.plugin.missionsUrlList;
                var mp = self.missionsPlugin();
                var list = self.urlDisplayedMissions || [];
                var statusEl = document.getElementById('mission_urllist_status');

                if (!list.length) {
                  if (statusEl) statusEl.textContent = 'コピー対象がありません';
                  return;
                }
                if (!navigator.clipboard || !navigator.clipboard.writeText) {
                  if (statusEl) statusEl.textContent = 'error: clipboard API not available';
                  return;
                }

                var lines = ['TITLE,Length,Time,Complete,Rating'];

                list.forEach(function (m) {
                  lines.push(mp.getMissionCopyCSV(m));
                });

                var stats = mp.getMissionCSVStats(list);

                lines.push(
                  [
                    'AVERAGE',
                    stats.averageLength != 0 ? Math.round(stats.averageLength * 1000) / 1000 + 'm' : '',
                    '',
                    stats.averagePlayer != 0 ? Math.round(stats.averagePlayer * 10) / 10 : '',
                    stats.averageRating,
                  ].join(',')
                );

                if (stats.totalLength != 0) {
                  lines.push(
                    [
                      'TOTAL',
                      stats.totalLength > 1000
                        ? Math.round(stats.totalLength / 100) / 10 + 'km(' + Math.round(stats.totalLength * 1000) / 1000 + 'm)'
                        : Math.round(stats.totalLength * 1000) / 1000 + 'm',
                      '',
                      stats.totalPlayer,
                      '',
                    ].join(',')
                  );
                }

                var text = lines.join('\n');

                navigator.clipboard.writeText(text).then(
                  function () {
                    if (statusEl) statusEl.textContent = 'done(Copy CSV: ' + list.length + ')';
                  },
                  function (err) {
                    console.log('fail: ' + err);
                    if (statusEl) statusEl.textContent = 'error: ' + err;
                  }
                );
              },
            },
            {
              text: 'Load details',
              css: { float: 'left', 'margin-right': '2px' },
              click: function () {
                window.plugin.missionsUrlList.loadDetailsForDialog();
              },
            },
            {
              text: 'Ok',
              click: function () {
                $(this).dialog('close');
              },
            },
          ],
        });
        openDialog = window.DIALOGS['dialog-missionsUrlListResult'];

        $(openDialog).dialog('option', 'position', topPosition);
        this.bindListDialogResize(openDialog, '.plugin-mission-urllist-list');
      }

      var prev = $(openDialog).find('.plugin-mission-urllist-list')[0];
      var scrollTop = !resetScroll && prev ? prev.scrollTop : 0;

      $(openDialog).empty().append(wrapper).dialog({ title: caption });

      this.fitListDialog(openDialog, content);

      content.scrollTop = scrollTop;
    },

    // 一覧モーダルが開いている場合のみ再描画
    refreshUrlMissionDialog: function () {
      if (window.DIALOGS['dialog-missionsUrlListResult']) {
        this.showUrlMissionDialog(false);
      }
    },

    // Missionsプラグインの詳細一括取得ロジック（loadDetailsForList）を借りて、表示中の一覧の詳細を取得する
    loadDetailsForDialog: function () {
      var self = this;
      var mp = this.missionsPlugin();
      var setStatus = function (text) {
        var el = document.getElementById('mission_urllist_status');
        if (el) el.textContent = text;
      };

      if (mp.isLoadingDetails) {
        setStatus('詳細を取得中です');
        return;
      }
      var list = this.urlDisplayedMissions || [];
      if (!list.length) {
        setStatus('対象がありません');
        return;
      }

      mp.loadDetailsForList(
        list,
        function (done, total) {
          setStatus('詳細取得中 ' + done + '/' + total);
        },
        function (total) {
          self.refreshUrlMissionDialog();
          setStatus(total ? '詳細取得完了 (' + total + '件)' : '取得済みです');
        }
      );
    },

    // リサイズ操作を拾う（作成時に1回だけ呼ぶ）
    bindListDialogResize: function (openDialog, listSelector) {
      var st = this.listDialogState;
      var $dlg = $(openDialog);

      // スクロールはリスト側に任せるので、モーダル本体はスクロールさせない
      $dlg.css('overflow', 'hidden');

      var apply = function () {
        var h = $dlg.closest('.ui-dialog').outerHeight();
        var listEl = $dlg.find(listSelector)[0];
        if (listEl && h > 0) {
          listEl.style.maxHeight = Math.max(h - st.overhead, 60) + 'px';
        }
        return h;
      };

      $dlg.on('dialogresize', apply);
      $dlg.on('dialogresizestop', function () {
        var h = apply();
        if (h > 0) st.height = h;
      });
    },

    // リストの高さを決める。未リサイズ：内容に合わせつつ画面の半分まで／リサイズ済み：そのサイズを保持
    fitListDialog: function (openDialog, listEl) {
      var st = this.listDialogState;
      var $dlg = $(openDialog);
      var $wrap = $dlg.closest('.ui-dialog');

      $dlg.dialog('option', 'height', 'auto');
      listEl.style.maxHeight = '0px';
      st.overhead = $wrap.outerHeight();

      if (st.height) {
        var available = window.map.getSize().y - $wrap.offset().top;
        var h = Math.max(Math.min(st.height, available), 100);
        $dlg.dialog('option', 'height', h);
        listEl.style.maxHeight = Math.max(h - st.overhead, 60) + 'px';
      } else {
        var half = Math.floor(window.innerHeight / 2);
        listEl.style.maxHeight = Math.max(half - st.overhead, 60) + 'px';
      }
    },

    setup: function () {
      if (!window.plugin.missions) {
        console.error('IITC plugin: Missions URL List requires "IITC plugin: Missions" to be loaded.');
        return;
      }

      IITC.toolbox.addButton({
        label: 'MissionList',
        action: () => window.plugin.missionsUrlList.showUrlInputDialog(),
      });
    },
  };

  var setup = window.plugin.missionsUrlList.setup.bind(window.plugin.missionsUrlList);
  // Missionsプラグイン本体が先に読み込まれている必要があるため、他のプラグインより後で実行する
  setup.priority = 'low';

  setup.info = plugin_info;
  if (typeof changelog !== 'undefined') setup.info.changelog = changelog;
  if (!window.bootPlugins) window.bootPlugins = [];
  window.bootPlugins.push(setup);
  if (window.iitcLoaded && typeof setup === 'function') setup();
} // wrapper end
// inject code into site context
var script = document.createElement('script');
var info = {};
if (typeof GM_info !== 'undefined' && GM_info && GM_info.script) info.script = { version: GM_info.script.version, name: GM_info.script.name, description: GM_info.script.description };
script.appendChild(document.createTextNode('(' + wrapper + ')(' + JSON.stringify(info) + ');'));
(document.body || document.head || document.documentElement).appendChild(script);