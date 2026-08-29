(function () {
  "use strict";

  var originalGameDetails = window.GameDetails;
  var originalSetStatusChanged = window.SetStatusChanged;
  var serverName = document.getElementById("server-name");
  var mapName = document.getElementById("map-name");
  var journeyMap = document.getElementById("journey-map");
  var journeyPercent = document.getElementById("journey-percent");
  var journeyStatus = document.getElementById("journey-status");
  var loadingBar = document.getElementById("loading");
  var statusRight = document.getElementById("status-right");
  var musicButton = document.getElementById("music-toggle");
  var musicState = document.getElementById("music-state");
  var musicHint = document.getElementById("music-hint");
  var muted = false;
  var journeyPhase = 0;
  // Yazı ile fotoğrafın aynı anda değişmesi için mesaj döngüsünü sleek.js'ten
  // devralıyoruz: id kalkınca sleek'in $("#messages") döngüsü boşa düşüyor.
  var messageBox = document.getElementById("messages");
  var fitTimer = null;
  // sleek.js arka planı tam ekran bir backstretch slaytına veriyor ve kurulurken
  // listedeki TÜM görselleri birden ön belleğe alıyor. Sinema çerçevesi bu işi
  // devraldığı için o slayt hem görünmez hem de tamamen boşa çalışıyor; çağrıyı
  // askıya alıp yalnızca devralma gerçekleşmezse serbest bırakıyoruz.
  var jq = window.jQuery;
  var realBackstretch = jq && jq.backstretch;
  var heldBackstretch = null;
  var cinemaStarted = false;

  if (realBackstretch) {
    jq.backstretch = function () {
      heldBackstretch = arguments;
      return this;
    };
  }

  if (messageBox) messageBox.removeAttribute("id");

  function setText(element, value, fallback) {
    if (!element) return;
    element.textContent = value && String(value).trim() ? value : fallback;
  }

  function updateServerDetails(name, map) {
    setText(serverName, name, "Bağlantı bekleniyor");
    setText(mapName, map, "—");
    setText(journeyMap, map, "—");
  }

  window.GameDetails = function () {
    updateServerDetails(arguments[0], arguments[2]);
    return originalGameDetails.apply(window, arguments);
  };

  function readableStatus(status) {
    var match;

    if (!status) return "Sunucu durumu bekleniyor";
    if (status === "Workshop Complete") return "Workshop içerikleri hazır";
    if (status === "Client info sent!") return "Oyun bilgileri sunucuya gönderildi";
    if (status === "Lua Started!") return "Sunucu kodları başlatılıyor";
    if (status === "Ready to play!") return "Giriş için her şey hazır";

    match = /^Downloaded (\d+) of (\d+)/.exec(status);
    if (match) return "Dosyalar indiriliyor: " + match[1] + " / " + match[2];

    match = /^(\d+)\/(\d+)/.exec(status);
    if (match) return "İçerikler hazırlanıyor: " + match[1] + " / " + match[2];

    match = /^Downloading\s+(.+)/i.exec(status);
    if (match) return "İndiriliyor: " + match[1];

    return status;
  }

  function paintJourney(activeStep, completedSteps) {
    var steps = document.querySelectorAll("#journey-steps li");
    var i;

    for (i = 0; i < steps.length; i += 1) {
      steps[i].className = "";
      if (i < completedSteps) steps[i].className = "is-complete";
      else if (i === activeStep) steps[i].className = "is-active";
    }
  }

  // GMod ilerlemeyi tek yönlü bildirir, ama aşamalar arasında sayaç durumları
  // ("12/450", "Downloaded 3 of 88") gönderir. Bunlar tanınmadığı için adımlar
  // başa dönüyordu; sayaç artık geriye düşmüyor.
  // 0: workshop  1: istemci bilgisi  2: lua / dosya indirme  3: girişe hazır
  function advanceJourney(phase) {
    if (phase > journeyPhase) journeyPhase = phase;
    if (journeyPhase >= 4) paintJourney(-1, 4);
    else paintJourney(journeyPhase, journeyPhase);
  }

  function updateJourney(status) {
    if (journeyStatus) journeyStatus.textContent = readableStatus(status);

    if (status === "Ready to play!") advanceJourney(4);
    else if (status === "Lua Started!") advanceJourney(3);
    else if (status === "Client info sent!") advanceJourney(2);
    else if (status === "Workshop Complete") advanceJourney(1);
    else if (/^Downloaded \d+ of \d+/.test(status)) advanceJourney(2);
    else advanceJourney(0);
  }

  window.SetStatusChanged = function () {
    updateJourney(arguments[0]);
    return originalSetStatusChanged.apply(window, arguments);
  };

  function safeUrl(value) {
    if (!value || !/^https?:\/\//i.test(value)) return "";
    return value;
  }

  function buildRules(items) {
    var section = document.getElementById("rules-section");
    var list = document.getElementById("rules-list");
    var i;

    if (!section || !list) return;
    if (!items || !items.length) {
      section.className += " is-empty";
      return;
    }

    for (i = 0; i < items.length; i += 1) {
      var item = document.createElement("li");
      item.textContent = items[i];
      list.appendChild(item);
    }
  }

  function buildSocialLinks(items) {
    var container = document.getElementById("social-links");
    var i;

    if (!container) return;
    if (!items || !items.length) {
      container.className += " is-empty";
      return;
    }

    for (i = 0; i < items.length; i += 1) {
      var data = items[i] || {};
      var url = safeUrl(data.url);
      var item = document.createElement(url ? "a" : "span");
      var icon = document.createElement("span");
      var copy = document.createElement("span");
      var label = document.createElement("small");
      var value = document.createElement("span");

      item.className = "social-item";
      if (url) {
        item.href = url;
        item.target = "_blank";
        item.rel = "noopener noreferrer";
      }

      icon.className = "social-icon";
      icon.textContent = data.icon || "•";
      copy.className = "social-copy";
      label.textContent = data.label || "";
      value.textContent = data.text || "";
      copy.appendChild(label);
      copy.appendChild(value);
      item.appendChild(icon);
      item.appendChild(copy);
      container.appendChild(item);
    }
  }

  function postToYoutube(command) {
    var iframe = document.querySelector("#player iframe");
    if (!iframe || !iframe.contentWindow) return;
    iframe.contentWindow.postMessage(JSON.stringify({
      event: "command",
      func: command,
      args: []
    }), "*");
  }

  function updateMusicButton() {
    var active;

    if (!musicButton || !musicState || !musicHint) return;
    active = window.config.music_enable && window.config.music_playlist && window.config.music_playlist.length;
    if (!active) {
      musicButton.disabled = true;
      musicState.textContent = "MÜZİK: KAPALI";
      musicHint.textContent = "Müzik yapılandırılmadı";
      return;
    }

    musicButton.disabled = false;
    musicButton.className = muted ? "music-button" : "music-button is-playing";
    musicState.textContent = muted ? "MÜZİK: SESSİZ" : "MÜZİK: AÇIK";
    musicHint.textContent = "Sessize almak için tıkla";
  }

  function toggleMusic() {
    var audio = document.querySelector("audio");
    muted = !muted;

    if (audio) audio.muted = muted;
    postToYoutube(muted ? "mute" : "unMute");
    updateMusicButton();
  }

  function numberOr(value, fallback) {
    var parsed = parseInt(value, 10);
    return isNaN(parsed) ? fallback : parsed;
  }

  function shuffle(list) {
    var i, j, swap;

    for (i = list.length - 1; i > 0; i -= 1) {
      j = Math.floor(Math.random() * (i + 1));
      swap = list[i];
      list[i] = list[j];
      list[j] = swap;
    }

    return list;
  }

  // Tur bitince deste yeniden karılıyor: sabit bir sıra oluşmuyor, ama art
  // arda aynı kare de gelmiyor.
  function reshuffle(list, lastItem) {
    shuffle(list);
    if (list.length > 1 && list[0] === lastItem) list.push(list.shift());
    return list;
  }

  function collectBackgrounds(cfg) {
    var list = cfg.background_images || [];
    var out = [];
    var name;
    var i;

    for (i = 0; i < list.length; i += 1) {
      name = String(list[i] || "");
      if (!name) continue;
      out.push(name.indexOf("/") === -1 ? "backgrounds/images/" + name : name);
    }

    if (cfg.background_images_random_order) shuffle(out);
    return out;
  }

  var FRAME_RATIO = 16 / 9;
  var FRAME_RING = 11;  // .cinema-frame / .journey-panel dış bezel halkasının kalınlığı
  var FRAME_GAP = 18;   // iki bezel halkası arasında kalan boşluk

  // GMod, yükleme ekranının sağ alt köşesine kendi workshop indirme panelini
  // çiziyor. Aşağıdaki iki sayı o panele ayrılan çerçevenin ölçüsü; oyundan
  // alınacak bir ekran görüntüsüne göre yalnızca bu ikisini değiştirmek yeterli.
  var ROW_HEIGHT = 82;  // .journey-panel yüksekliği

  // Dikey boşluğu artırmak sol paneli kısaltıyor. Bu ölçüm HER ZAMAN temel
  // boşlukta yapılmalı; yoksa "sığdı / sığmadı" sonucu bir öncekine bağlı
  // kalıyor ve değer iki uç arasında salınıyor.
  function rulesSpare() {
    var card = document.getElementById("rules-section");
    var list = document.getElementById("rules-list");
    var title = card && card.querySelector(".section-title");
    var style;
    var needed;
    var available;

    if (!card || !list || card.offsetHeight === 0) return 0;

    style = window.getComputedStyle(card);
    available = card.clientHeight
      - (parseInt(style.paddingTop, 10) || 0)
      - (parseInt(style.paddingBottom, 10) || 0);
    needed = list.scrollHeight;

    if (title) {
      needed += title.offsetHeight
        + (parseInt(window.getComputedStyle(title).marginBottom, 10) || 0);
    }

    return available - needed;
  }

  function fitFrame() {
    var screen = document.querySelector(".loading-screen");
    var frame = document.querySelector(".cinema-frame");
    var journey = document.querySelector(".journey-panel");
    var column = frame && frame.parentNode;
    var basePad;
    var rowHeight;
    var bottomBlock;
    var roomWidth;
    var roomHeight;
    var width;
    var height;
    var slack;
    var spare;
    var extra;
    var edge;
    var journeyWidth;
    var wanted;

    if (!screen || !column) return;

    // Kırılım değişmiş olabilir: dikey boşluğu sıfırlayıp stil dosyasındaki
    // gerçek değeri okuyoruz.
    screen.style.paddingTop = "";
    screen.style.paddingBottom = "";
    basePad = parseInt(window.getComputedStyle(screen).paddingTop, 10) || 24;

    spare = rulesSpare();

    // Hiçbir ölçüm yok: alt sıra yüksekliği sabit. Böylece CSS geç gelse de
    // hesap doğru ve fonksiyon hiçbir noktada yarım uygulanmış hal bırakmıyor.
    rowHeight = (journey && window.getComputedStyle(journey).display !== "none")
      ? ROW_HEIGHT
      : 0;

    // Hesap bezel halkaları dahil yapılıyor: ekranın ve alt sıranın dış kenarı
    // sol panelin kenarlığıyla birebir aynı hizaya otursun.
    bottomBlock = rowHeight ? rowHeight + FRAME_RING * 2 + FRAME_GAP : 0;
    roomWidth = column.clientWidth - FRAME_RING * 2;
    roomHeight = column.clientHeight - bottomBlock - FRAME_RING * 2;
    // Erken çıkarsak sıfırladığımız dikey boşluğu geri koy.
    if (roomWidth <= 0 || roomHeight <= 0) {
      screen.style.paddingTop = basePad + "px";
      screen.style.paddingBottom = basePad + "px";
      return;
    }

    // Çerçeve border-box olduğu için 1px'lik kenarlıkları hesaba katıyoruz;
    // böylece 16:9 oran fotoğrafın çizildiği iç alanda birebir tutuyor.
    width = roomWidth;
    height = Math.round((width - 2) / FRAME_RATIO) + 2;
    slack = roomHeight - height;

    // 1440p ve üstünde 16:9 çerçeve ile alt sıra arasında kocaman bir boşluk
    // kalıyordu; artan yeri sayfanın dikey boşluğuna dağıtıp bütünü dengeliyoruz.
    if (slack > 24) {
      extra = Math.min(Math.floor(slack / 2), Math.round(window.innerHeight * 0.13));
      screen.style.paddingTop = (basePad + extra) + "px";
      screen.style.paddingBottom = (basePad + extra) + "px";

      // Kurallar kısılan panele sığmadıysa boşluğu o kadar geri ver.
      spare = rulesSpare();
      if (spare < 14) extra = Math.max(extra - Math.ceil((14 - spare) / 2), 0);

      screen.style.paddingTop = (basePad + extra) + "px";
      screen.style.paddingBottom = (basePad + extra) + "px";
      roomHeight = column.clientHeight - bottomBlock - FRAME_RING * 2;
      slack = roomHeight - height;
      if (slack < 0) {
        height = roomHeight;
        width = Math.round((height - 2) * FRAME_RATIO) + 2;
      }
    }

    if (slack < 0) {
      height = roomHeight;
      width = Math.round((height - 2) * FRAME_RATIO) + 2;
    }

    // Üst kenar sol panelle aynı hizada kalsın diye çerçeve yukarı sabitleniyor.
    edge = FRAME_RING + Math.round((roomWidth - width) / 2);
    frame.style.width = width + "px";
    frame.style.height = height + "px";
    frame.style.left = edge + "px";
    frame.style.top = FRAME_RING + "px";
    frame.style.right = "auto";
    frame.style.bottom = "auto";

    // Alt bar ekranla aynı genişlikte ve hizada.
    if (journey) {
      journeyWidth = width;

      // 470px altında adımlar sığmıyor ve taşıyor; günlüğü tamamen gizliyoruz.
      if (journeyWidth < 470) {
        journey.style.display = "none";
      } else {
        journey.style.display = "";
        wanted = journeyWidth < 640 ? "journey-panel is-compact" : "journey-panel";
        if (journey.className !== wanted) journey.className = wanted;
        journey.style.left = edge + "px";
        journey.style.width = journeyWidth + "px";
        journey.style.height = rowHeight + "px";
        journey.style.right = "auto";
        journey.style.bottom = FRAME_RING + "px";
      }
    }
  }

  function createMessageDeck(cfg, fade) {
    var list = cfg.messages_list ? cfg.messages_list.slice(0) : [];
    var half = Math.max(Math.round(fade / 2), 120);
    var random = !!cfg.messages_random_order;
    var cursor = -1;

    if (!messageBox || !cfg.messages_enable || !list.length) return null;
    if (random) shuffle(list);

    messageBox.style.setProperty("transition", "opacity " + half + "ms ease-in-out", "important");
    messageBox.style.opacity = "0";

    return function () {
      var text;

      cursor += 1;
      if (cursor >= list.length) {
        if (random) reshuffle(list, list[list.length - 1]);
        cursor = 0;
      }
      text = list[cursor];
      messageBox.style.opacity = "0";

      // Yazı, fotoğraf geçişinin tam ortasında değişiyor.
      window.setTimeout(function () {
        messageBox.innerHTML = text;
        messageBox.style.opacity = "1";
      }, half);
    };
  }

  // Fotoğraf döngüsü çalışmıyorsa (video arka planı veya boş liste) yazılar
  // kendi temposunda dönsün.
  function driveMessagesAlone(nextMessage, hold) {
    if (!nextMessage) return;
    nextMessage();
    window.setInterval(nextMessage, hold);
  }

  function releaseBackstretch() {
    if (!realBackstretch || cinemaStarted) return;
    jq.backstretch = realBackstretch;

    // Boş listeyle çağrıldığında backstretch hata fırlatıyor; askıya alınmış
    // çağrının hatası bizim akışımızı kesmesin.
    try {
      if (heldBackstretch) realBackstretch.apply(jq, heldBackstretch);
    } catch (error) {
      if (window.console && console.warn) console.warn("Backstretch:", error.message);
    }

    heldBackstretch = null;
  }

  function enableCinema() {
    // Stub yerinde kalıyor: sleek.js kendi backstretch çağrısını bu noktadan
    // sonra da yapabiliyor ve gerçek fonksiyon geri konursa 30 görselin hepsi
    // yeniden ön belleğe alınıyor.
    cinemaStarted = true;
    heldBackstretch = null;
    if (document.body.className.indexOf("cinema-on") === -1) {
      document.body.className += " cinema-on";
    }
  }

  // Arka plan videosu kullanılıyorsa videoyu tam ekrandan alıp çerçeveye taşı.
  function stageVideo(frame) {
    var attempts = 0;

    (function poll() {
      var video = document.querySelector("#video-container video");

      if (video) {
        frame.insertBefore(video, frame.querySelector(".cinema-vignette"));
        enableCinema();
        return;
      }

      attempts += 1;
      if (attempts < 200) window.setTimeout(poll, 50);
    }());
  }

  function startCinema() {
    var cfg = window.config;
    var frame = document.querySelector(".cinema-frame");
    var primary = document.getElementById("cinema-image");
    var fade;
    var hold;
    var sources;
    var layers;
    var active = 1;
    var current = 0;
    var nextMessage;

    if (!cfg || !frame || !primary) {
      releaseBackstretch();
      return;
    }

    fade = numberOr(cfg.background_images_fade_duration, 1200);
    hold = Math.max(numberOr(cfg.background_images_duration, 5000), 1200);
    nextMessage = createMessageDeck(cfg, fade);

    if (cfg.background_use_video) {
      stageVideo(frame);
      driveMessagesAlone(nextMessage, hold);
      releaseBackstretch();
      return;
    }

    sources = collectBackgrounds(cfg);
    if (!sources.length) {
      driveMessagesAlone(nextMessage, hold);
      releaseBackstretch();
      return;
    }

    // Her kare için bir katman: altta karenin bulanık kopyası, üstte
    // kırpılmadan sığdırılmış fotoğrafın kendisi.
    function buildShot(image) {
      var shot = document.createElement("div");

      shot.className = "cinema-shot";
      // !important: Windows'ta animasyonlar kapalıyken (prefers-reduced-motion)
      // stil dosyasındaki genel kural geçişi sıfırlıyor ve kareler sert kesiliyor.
      shot.style.setProperty("transition-duration", fade + "ms", "important");
      shot.appendChild(image);
      return shot;
    }

    var anchor = primary.nextSibling;
    var clone = primary.cloneNode(false);

    clone.removeAttribute("id");
    layers = [buildShot(primary), buildShot(clone)];
    frame.insertBefore(layers[0], anchor);
    frame.insertBefore(layers[1], anchor);

    function reveal(index) {
      var incoming = layers[1 - active];
      var outgoing = layers[active];
      var source = sources[index];

      incoming.firstChild.src = source;
      incoming.style.zIndex = 2;
      outgoing.style.zIndex = 1;
      incoming.className = "cinema-shot is-visible";
      active = 1 - active;

      // Geçiş bitince alttaki kareyi sıfırla; üstteki kare tamamen opak olduğu
      // için bu sırada ekranda hiçbir kararma görünmez.
      window.setTimeout(function () {
        if (outgoing !== layers[active]) outgoing.className = "cinema-shot";
      }, fade + 60);

      if (nextMessage) nextMessage();
    }

    function paint(index) {
      var loader = new Image();

      loader.onload = function () { reveal(index); };
      loader.onerror = function () { reveal(index); };
      loader.src = sources[index];
    }

    enableCinema();
    fitFrame();
    paint(current);

    if (sources.length > 1) {
      window.setInterval(function () {
        current += 1;
        if (current >= sources.length) {
          if (cfg.background_images_random_order) {
            reshuffle(sources, sources[sources.length - 1]);
          }
          current = 0;
        }
        paint(current);
      }, hold);
    }
  }

  function watchProgress() {
    if (!window.MutationObserver || !statusRight || !loadingBar) return;
    var observer = new MutationObserver(function () {
      var value = parseInt(statusRight.textContent, 10);
      if (!isNaN(value)) {
        loadingBar.setAttribute("aria-valuenow", value);
        if (journeyPercent) journeyPercent.textContent = value + "%";
        if (value >= 100) advanceJourney(4);
      }
    });
    observer.observe(statusRight, { childList: true, characterData: true, subtree: true });
  }

  function waitForConfig() {
    if (!window.config || typeof window.config.errors_show_ingame === "undefined") {
      window.setTimeout(waitForConfig, 25);
      return;
    }

    var ui = window.config.ui || {};
    buildRules(ui.rules || []);
    buildSocialLinks(ui.links || []);
    updateMusicButton();
    startCinema();
  }

  window.setTimeout(releaseBackstretch, 8000);

  // Stil dosyası ve fontlar ağdan geldiğinde ölçüler değişiyor; yerleşimi
  // yeniden kuruyoruz.
  window.addEventListener("load", fitFrame, false);
  window.setTimeout(fitFrame, 400);
  window.setTimeout(fitFrame, 1500);

  if (document.fonts && document.fonts.ready && document.fonts.ready.then) {
    document.fonts.ready.then(fitFrame);
  }

  window.addEventListener("resize", function () {
    window.clearTimeout(fitTimer);
    fitTimer = window.setTimeout(fitFrame, 120);
  }, false);

  if (musicButton) musicButton.addEventListener("click", toggleMusic, false);
  watchProgress();
  waitForConfig();
}());
