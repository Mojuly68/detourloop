// One map runtime for web and native. It is plain JavaScript in a string so the exact same code
// runs in the browser (web) and inside a WebView (iOS/Android). MapLibre GL JS draws the map;
// tiles are Mapbox (with a public token) or OpenFreeMap (no key).
//
// Why not @rnmapbox/maps? It needs a custom dev build and does not run on web. This runtime works
// in Expo Go, on web and in production builds. Swapping in @rnmapbox/maps later only touches
// components/map/*.

export const MAPLIBRE_VERSION = '4.7.1';
export const MAPLIBRE_JS = `https://unpkg.com/maplibre-gl@${MAPLIBRE_VERSION}/dist/maplibre-gl.js`;
export const MAPLIBRE_CSS = `https://unpkg.com/maplibre-gl@${MAPLIBRE_VERSION}/dist/maplibre-gl.css`;

export interface MapMarker {
  id: string;
  lng: number;
  lat: number;
  kind: 'origin' | 'dest' | 'stop' | 'discovery' | 'me' | 'media';
  label?: string;
  n?: number;          // stop number
  icon?: string;       // short glyph for discoveries
  img?: string;        // photo marker (replay)
  at?: number;         // 0-1 position along the journey (replay reveal)
}

export interface MapProps {
  route?: [number, number][];
  routeStyle?: 'solid' | 'dashed';
  markers?: MapMarker[];
  selectedId?: string;
  /** Change this to re-fit the camera and replay the route draw-in animation. */
  fitKey?: string;
  center?: [number, number];
  zoom?: number;
  /** 0-1: draw only this fraction of the route (TravelReplay). Undefined = full route. */
  progress?: number;
  /** Follow the head of the route while progress plays. */
  follow?: boolean;
  mapboxToken?: string;
  interactive?: boolean;
}

export const RUNTIME = String.raw`
(function(){
  var C = { ocean:'#183C50', teal:'#285B65', sand:'#D7C5A7', cream:'#E9E4D9', charcoal:'#38352F', white:'#F8F7F3' };
  var css = document.createElement('style');
  css.textContent = [
    '.dt-m{cursor:pointer}.dt-m>*{transform-origin:50% 100%;animation:dtdrop .45s cubic-bezier(.2,1.4,.4,1) both}',
    '@keyframes dtdrop{from{opacity:0;translate:0 -14px;scale:.6}to{opacity:1;translate:0 0;scale:1}}',
    '@media (prefers-reduced-motion: reduce){.dt-m>*{animation:none}.dt-pulse:after{animation:none!important}}',
    '.dt-pin{min-width:30px;height:30px;padding:0 6px;border-radius:15px 15px 15px 3px;transform:rotate(-45deg);display:flex;align-items:center;justify-content:center;box-shadow:0 6px 14px rgba(15,42,56,.35);border:2px solid #F8F7F3}',
    '.dt-pin span{transform:rotate(45deg);font:700 12px/1 Roboto,system-ui,sans-serif;color:#F8F7F3}',
    '.dt-dot{width:26px;height:26px;border-radius:13px;background:#F8F7F3;border:2px solid '+C.teal+';display:flex;align-items:center;justify-content:center;font:700 11px/1 system-ui;color:'+C.teal+';box-shadow:0 4px 10px rgba(15,42,56,.25);transition:transform .2s}',
    '.dt-dot.sel{transform:scale(1.35);background:'+C.ocean+';color:#F8F7F3;border-color:#F8F7F3}',
    '.dt-me{width:18px;height:18px;border-radius:9px;background:#2F7DD1;border:3px solid #fff;box-shadow:0 0 0 2px rgba(47,125,209,.3)}',
    '.dt-pulse{position:relative}.dt-pulse:after{content:"";position:absolute;inset:-10px;border-radius:50%;border:2px solid rgba(47,125,209,.5);animation:dtp 1.8s ease-out infinite}',
    '@keyframes dtp{from{transform:scale(.5);opacity:1}to{transform:scale(1.6);opacity:0}}',
    '.dt-photo{width:54px;height:54px;border-radius:14px;border:3px solid #F8F7F3;background-size:cover;background-position:center;box-shadow:0 8px 18px rgba(15,42,56,.4)}',
    '.dt-label{position:absolute;top:34px;left:50%;transform:translateX(-50%);white-space:nowrap;background:rgba(248,247,243,.94);color:'+C.charcoal+';font:600 11px/1 Roboto,system-ui;padding:4px 7px;border-radius:8px;box-shadow:0 2px 6px rgba(0,0,0,.12)}',
    '.maplibregl-ctrl-attrib{font-size:10px}'
  ].join('');
  document.head.appendChild(css);

  window.createDetourMap = function(maplibregl, el, emit, initial){
    var props = initial || {};
    var token = props.mapboxToken;
    var style = token ? {
      version: 8,
      sources: { base: { type:'raster', tileSize:512, tiles:['https://api.mapbox.com/styles/v1/mapbox/outdoors-v12/tiles/512/{z}/{x}/{y}@2x?access_token='+token], attribution:'© Mapbox © OpenStreetMap' } },
      layers: [{ id:'base', type:'raster', source:'base' }]
    } : 'https://tiles.openfreemap.org/styles/positron';

    var map = new maplibregl.Map({
      container: el, style: style, center: props.center || [-120.5, 36.6], zoom: props.zoom || 5,
      attributionControl: { compact: true }, interactive: props.interactive !== false, pitchWithRotate: false, dragRotate: false
    });
    var markers = {};
    var ready = false;
    var drawAnim = null;
    var lastFit = null;
    var lastSel = null;

    function tint(){
      if (token) return;
      try {
        map.getStyle().layers.forEach(function(l){
          var id = l.id.toLowerCase();
          if (l.type === 'background') map.setPaintProperty(l.id, 'background-color', '#EDE8DE');
          else if (l.type === 'fill' && id.indexOf('water') >= 0) map.setPaintProperty(l.id, 'fill-color', '#B7CACD');
          else if (l.type === 'fill' && (id.indexOf('park') >= 0 || id.indexOf('wood') >= 0 || id.indexOf('grass') >= 0 || id.indexOf('landcover') >= 0)) map.setPaintProperty(l.id, 'fill-color', '#DCE0CF');
          else if (l.type === 'line' && id.indexOf('water') >= 0) map.setPaintProperty(l.id, 'line-color', '#A9BEC2');
        });
      } catch(e) {}
    }

    function sliceLine(coords, f){
      if (f === undefined || f >= 1) return coords;
      if (f <= 0 || coords.length < 2) return coords.slice(0,1).concat(coords.slice(0,1));
      var n = (coords.length - 1) * f, i = Math.floor(n), t = n - i;
      var out = coords.slice(0, i + 1);
      var a = coords[i], b = coords[Math.min(i + 1, coords.length - 1)];
      out.push([a[0] + (b[0]-a[0]) * t, a[1] + (b[1]-a[1]) * t]);
      return out;
    }

    function setRoute(coords, f){
      var data = { type:'Feature', properties:{}, geometry:{ type:'LineString', coordinates: coords && coords.length > 1 ? sliceLine(coords, f) : [] } };
      var src = map.getSource('route');
      if (src) src.setData(data);
      else {
        map.addSource('route', { type:'geojson', data: data });
        map.addLayer({ id:'route-casing', type:'line', source:'route', layout:{ 'line-cap':'round', 'line-join':'round' }, paint:{ 'line-color':'#F8F7F3', 'line-width':9, 'line-opacity':0.95 } });
        map.addLayer({ id:'route-line', type:'line', source:'route', layout:{ 'line-cap':'round', 'line-join':'round' }, paint:{ 'line-color': C.ocean, 'line-width':4.5 } });
      }
      try { map.setPaintProperty('route-line', 'line-dasharray', props.routeStyle === 'dashed' ? [1.5, 2] : [1, 0]); } catch(e) {}
      return data.geometry.coordinates;
    }

    function markerEl(m){
      var wrap = document.createElement('div');
      wrap.className = 'dt-m';
      wrap.setAttribute('role', 'button');
      wrap.setAttribute('aria-label', m.label || m.kind);
      var inner;
      if (m.kind === 'me') { inner = document.createElement('div'); inner.className = 'dt-me dt-pulse'; }
      else if (m.kind === 'media' && m.img) { inner = document.createElement('div'); inner.className = 'dt-photo'; inner.style.backgroundImage = 'url("' + m.img.replace(/"/g, '') + '")'; }
      else if (m.kind === 'discovery') { inner = document.createElement('div'); inner.className = 'dt-dot'; inner.textContent = m.icon || '•'; }
      else {
        inner = document.createElement('div'); inner.className = 'dt-pin';
        inner.style.background = m.kind === 'origin' ? C.charcoal : m.kind === 'dest' ? C.teal : C.ocean;
        var s = document.createElement('span'); s.textContent = m.kind === 'origin' ? 'A' : m.kind === 'dest' ? 'B' : String(m.n || ''); inner.appendChild(s);
      }
      wrap.appendChild(inner);
      if (m.label && (m.kind === 'origin' || m.kind === 'dest')) { var lb = document.createElement('div'); lb.className = 'dt-label'; lb.textContent = m.label; wrap.appendChild(lb); }
      wrap.addEventListener('click', function(e){ e.stopPropagation(); emit({ type:'marker', id: m.id }); });
      return wrap;
    }

    function syncMarkers(list, f){
      var keep = {};
      (list || []).forEach(function(m){
        if (f !== undefined && m.at !== undefined && m.at > f + 1e-6) return;
        var key = m.id + '|' + m.kind + '|' + (m.n || '') + '|' + (m.img || '');
        keep[key] = true;
        if (!markers[key]) {
          var el = markerEl(m);
          markers[key] = { mk: new maplibregl.Marker({ element: el, anchor: m.kind === 'stop' || m.kind === 'origin' || m.kind === 'dest' ? 'bottom' : 'center' }).setLngLat([m.lng, m.lat]).addTo(map), el: el, id: m.id };
        } else markers[key].mk.setLngLat([m.lng, m.lat]);
      });
      Object.keys(markers).forEach(function(k){ if (!keep[k]) { markers[k].mk.remove(); delete markers[k]; } });
      Object.keys(markers).forEach(function(k){
        var d = markers[k].el.querySelector('.dt-dot');
        if (d) d.classList.toggle('sel', markers[k].id === props.selectedId);
      });
    }

    function fit(){
      var pts = [];
      (props.route || []).forEach(function(c){ pts.push(c); });
      (props.markers || []).forEach(function(m){ if (m.kind !== 'discovery') pts.push([m.lng, m.lat]); });
      if (!pts.length) (props.markers || []).forEach(function(m){ pts.push([m.lng, m.lat]); });
      if (!pts.length) { if (props.center) map.easeTo({ center: props.center, zoom: props.zoom || 10, duration: 800 }); return; }
      if (pts.length === 1) { map.easeTo({ center: pts[0], zoom: props.zoom || 11, duration: 800 }); return; }
      var b = new maplibregl.LngLatBounds(pts[0], pts[0]);
      pts.forEach(function(p){ b.extend(p); });
      map.fitBounds(b, { padding: { top: 70, bottom: 70, left: 50, right: 50 }, duration: 900, maxZoom: 13 });
    }

    function render(animateDraw){
      if (!ready) return;
      if (drawAnim) { cancelAnimationFrame(drawAnim); drawAnim = null; }
      var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (animateDraw && props.route && props.route.length > 1 && props.progress === undefined && !reduce) {
        var t0 = performance.now(), D = 1400;
        var step = function(now){
          var f = Math.min(1, (now - t0) / D); f = 1 - Math.pow(1 - f, 3);
          setRoute(props.route, f);
          if (f < 1) drawAnim = requestAnimationFrame(step); else drawAnim = null;
        };
        setRoute(props.route, 0.001);
        drawAnim = requestAnimationFrame(step);
      } else {
        var drawn = setRoute(props.route, props.progress);
        if (props.follow && props.progress !== undefined && drawn.length) map.easeTo({ center: drawn[drawn.length - 1], duration: 300, easing: function(x){ return x; } });
      }
      syncMarkers(props.markers, props.progress);
    }

    map.on('load', function(){
      tint(); ready = true;
      var key = props.fitKey || 'init';
      lastFit = key; fit(); render(true);
      emit({ type:'ready' });
    });
    map.on('click', function(){ emit({ type:'mapclick' }); });

    return {
      update: function(next){
        props = next || {};
        if (!ready) return;
        var key = props.fitKey || 'init';
        if (key !== lastFit) { lastFit = key; fit(); render(true); }
        else render(false);
        if (props.selectedId && props.selectedId !== lastSel) {
          lastSel = props.selectedId;
          var sel = (props.markers || []).filter(function(m){ return m.id === props.selectedId; })[0];
          if (sel) map.easeTo({ center: [sel.lng, sel.lat], duration: 500 });
        }
      },
      resize: function(){ map.resize(); },
      destroy: function(){ map.remove(); }
    };
  };
})();
`;
