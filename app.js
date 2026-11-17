(() => {
  'use strict';
  const M=window.MiniDrawScene;
  const $=selector=>document.querySelector(selector);
  const svg=$('#canvas');
  const NS='http://www.w3.org/2000/svg';
  let scene={elements:[],background:'#ffffff'};
  let defaults={...M.DEFAULT_STYLE};
  let selected=null,tool='select',gesture=null,zoom=1,camera={x:0,y:0};
  let undoStack=[],redoStack=[],baseName='제목 없는 드로잉',toastTimer,exportScale=1;
  const selectedElement=()=>scene.elements.find(e=>e.id===selected);
  const snapshot=()=>M.clone(scene);
  const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
  function toast(message) {clearTimeout(toastTimer);$('#toast').textContent=message;$('#toast').hidden=false;toastTimer=setTimeout(()=>$('#toast').hidden=true,5500);}
  function commit(before) {
    if (equal(before,scene)) return;
    undoStack.push(before);if(undoStack.length>100)undoStack.shift();redoStack=[];
    render();
  }
  function edit(action) {const before=snapshot();action();commit(before);}
  function history(redo=false) {
    cancelGesture();const from=redo?redoStack:undoStack,to=redo?undoStack:redoStack;
    if(!from.length)return;
    to.push(snapshot());scene=from.pop();if(!selectedElement())selected=null;render();
  }
  function element(tag,attributes) {const node=document.createElementNS(NS,tag);for(const [key,value]of Object.entries(attributes))node.setAttribute(key,value);return node;}
  function render() {
    const width=svg.clientWidth,height=svg.clientHeight;
    svg.setAttribute('viewBox',`${camera.x} ${camera.y} ${width/zoom} ${height/zoom}`);
    svg.style.background=scene.background;svg.dataset.tool=tool;
    const fragment=document.createDocumentFragment();
    for(const e of scene.elements){
      const attrs={x:e.x,y:e.y,width:e.width,height:e.height,rx:M.radius(e)};
      const group=element('g',{'data-id':e.id});
      group.append(element('rect',{...attrs,fill:e.backgroundColor==='transparent'?'none':e.backgroundColor,stroke:e.strokeColor,'stroke-width':e.strokeWidth,'stroke-dasharray':M.dash(e).join(' '),'stroke-linecap':'round','stroke-linejoin':'round',opacity:e.opacity/100,'pointer-events':'none'}));
      // A transparent interaction layer remains usable even at zero opacity.
      group.append(element('rect',{...attrs,fill:'transparent',stroke:'transparent','stroke-width':Math.max(e.strokeWidth,12/zoom),'pointer-events':e.backgroundColor==='transparent'?'stroke':'all'}));
      fragment.append(group);
    }
    const e=selectedElement();
    if(e && tool==='select'){
      fragment.append(element('rect',{x:e.x-4/zoom,y:e.y-4/zoom,width:e.width+8/zoom,height:e.height+8/zoom,fill:'none',stroke:'#8d7bd5','stroke-width':1/zoom,'pointer-events':'none'}));
      for(const [corner,x,y]of [['nw',e.x,e.y],['ne',e.x+e.width,e.y],['sw',e.x,e.y+e.height],['se',e.x+e.width,e.y+e.height]]){
        fragment.append(element('rect',{x:x-4/zoom,y:y-4/zoom,width:8/zoom,height:8/zoom,rx:2/zoom,fill:'#fff',stroke:'#8d7bd5','stroke-width':1/zoom,'data-handle':corner,style:`cursor:${corner==='nw'||corner==='se'?'nwse':'nesw'}-resize`}));
      }
    }
    svg.replaceChildren(fragment);
    $('#empty-state').hidden=scene.elements.length>0||tool!=='select';
    $('#style-panel').hidden=!e&&tool!=='rectangle'||tool==='hand';
    $('#style-context').textContent=e?'선택한 도형':'새 도형 스타일';
    $('#object-count').textContent=`${scene.elements.length}개 도형`;
    $('#document-name').textContent=baseName;
    $('#undo').disabled=!undoStack.length;$('#redo').disabled=!redoStack.length;
    $('#fit').textContent=`${Math.round(zoom*100)}%`;
    $('#zoom-out').disabled=zoom<=.25;$('#zoom-in').disabled=zoom>=4;
    $('#delete-button').hidden=!e;
    $('#geometry').hidden=!e;
    $('#geometry').textContent=e?`X ${Math.round(e.x)} · Y ${Math.round(e.y)}　/　${Math.round(e.width)} × ${Math.round(e.height)}`:'';
    $('#hint').textContent=tool==='rectangle'?'드래그하여 사각형 그리기 · Esc 취소':tool==='hand'?'캔버스를 드래그하여 화면 이동':e?'끌어서 이동 · 모서리로 크기 조절 · Delete 삭제':'도형을 클릭하여 선택 · R 사각형 그리기';
    document.querySelectorAll('[data-tool]').forEach(b=>{if(b.tagName==='BUTTON')b.setAttribute('aria-pressed',b.dataset.tool===tool);});
    updateStyleUI(e||defaults);
  }
  function updateStyleUI(style){
    document.querySelectorAll('[data-stroke]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.stroke===style.strokeColor));
    document.querySelectorAll('[data-fill]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.fill===style.backgroundColor));
    document.querySelectorAll('[data-width]').forEach(b=>b.setAttribute('aria-pressed',Number(b.dataset.width)===style.strokeWidth));
    document.querySelectorAll('[data-line]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.line===style.strokeStyle));
    document.querySelectorAll('[data-rounded]').forEach(b=>b.setAttribute('aria-pressed',(b.dataset.rounded==='true')===style.rounded));
    $('#stroke-color').value=style.strokeColor;$('#fill-color').value=style.backgroundColor==='transparent'?'#ffffff':style.backgroundColor;
    $('#opacity').value=style.opacity;$('#opacity-value').value=`${style.opacity}%`;
  }
  function chooseTool(next){cancelGesture();tool=next;if(next!=='select')selected=null;closeMenu();render();}
  function point(event){const box=svg.getBoundingClientRect();return{x:(event.clientX-box.left)/zoom+camera.x,y:(event.clientY-box.top)/zoom+camera.y};}
  function setBounds(e,a,b){e.x=Math.min(a.x,b.x);e.y=Math.min(a.y,b.y);e.width=Math.abs(b.x-a.x);e.height=Math.abs(b.y-a.y);}
  function cancelGesture(){if(!gesture)return;scene=gesture.before;camera=gesture.cameraBefore;gesture=null;svg.classList.remove('dragging');render();}
  svg.addEventListener('pointerdown',event=>{
    if(event.button!==0||gesture)return;event.preventDefault();closeMenu();svg.focus();
    const start=point(event),before=snapshot(),cameraBefore={...camera};
    const handle=event.target.dataset.handle;
    const id=event.target.closest('[data-id]')?.dataset.id;
    if(tool==='hand')gesture={kind:'pan',start,client:{x:event.clientX,y:event.clientY},before,cameraBefore};
    else if(tool==='rectangle'){
      if(scene.elements.length>=2000){toast('최대 2,000개의 도형을 만들 수 있습니다.');return;}
      const e={id:crypto.randomUUID(),type:'rectangle',x:start.x,y:start.y,width:0,height:0,...defaults};scene.elements.push(e);selected=e.id;
      gesture={kind:'draw',start,before,cameraBefore,id:e.id};
    }else if(handle&&selectedElement()){
      const e=selectedElement();const anchor={x:handle.includes('w')?e.x+e.width:e.x,y:handle.includes('n')?e.y+e.height:e.y};
      gesture={kind:'resize',start,anchor,before,cameraBefore,id:e.id};
    }else if(id){selected=id;gesture={kind:'move',start,before,cameraBefore,id,original:{...selectedElement()}};}
    else selected=null;
    if(gesture){svg.setPointerCapture(event.pointerId);svg.classList.add('dragging');}
    render();
  });
  svg.addEventListener('pointermove',event=>{
    if(!gesture)return;const current=point(event),g=gesture;
    if(g.kind==='pan'){camera.x=g.cameraBefore.x-(event.clientX-g.client.x)/zoom;camera.y=g.cameraBefore.y-(event.clientY-g.client.y)/zoom;}
    else{
      const e=scene.elements.find(e=>e.id===g.id);
      if(g.kind==='draw')setBounds(e,g.start,current);
      if(g.kind==='resize')setBounds(e,g.anchor,current);
      if(g.kind==='move'){e.x=g.original.x+current.x-g.start.x;e.y=g.original.y+current.y-g.start.y;}
    }
    render();
  });
  svg.addEventListener('pointerup',event=>{
    if(!gesture)return;const g=gesture;gesture=null;
    if(svg.hasPointerCapture(event.pointerId))svg.releasePointerCapture(event.pointerId);
    svg.classList.remove('dragging');
    const e=selectedElement();
    if(g.kind==='draw'&&(e.width<2||e.height<2)){scene=g.before;selected=null;}
    else if(g.kind==='resize'&&(e.width<2||e.height<2)){scene=g.before;}
    else if(g.kind!=='pan'){tool='select';commit(g.before);}
    render();
  });
  svg.addEventListener('pointercancel',cancelGesture);
  svg.addEventListener('lostpointercapture',()=>{if(gesture)cancelGesture();});
  function setStyle(key,value){
    defaults[key]=value;const e=selectedElement();if(e)edit(()=>e[key]=value);render();
  }
  function makeSwatches(container,kind,colors){
    for(const [value,name]of colors){const button=document.createElement('button');button.className='swatch'+(value==='transparent'?' transparent':'');button.dataset[kind]=value;button.style.setProperty('--swatch',value);if(value!=='transparent')button.style.backgroundColor=value;button.title=name;button.setAttribute('aria-label',`${kind==='stroke'?'선 색상':'배경색'} ${name}`);button.addEventListener('click',()=>setStyle(kind==='stroke'?'strokeColor':'backgroundColor',value));$(container).append(button);}
  }
  makeSwatches('#stroke-swatches','stroke',[['#1e1e1e','검정'],['#e03131','빨강'],['#2f9e44','초록'],['#1971c2','파랑'],['#f08c00','주황']]);
  makeSwatches('#fill-swatches','fill',[['transparent','투명'],['#ffc9c9','분홍'],['#b2f2bb','연두'],['#a5d8ff','하늘'],['#ffec99','노랑']]);
  document.querySelectorAll('[data-width]').forEach(b=>b.onclick=()=>setStyle('strokeWidth',Number(b.dataset.width)));
  document.querySelectorAll('[data-line]').forEach(b=>b.onclick=()=>setStyle('strokeStyle',b.dataset.line));
  document.querySelectorAll('[data-rounded]').forEach(b=>b.onclick=()=>setStyle('rounded',b.dataset.rounded==='true'));
  $('#stroke-color').onchange=e=>setStyle('strokeColor',e.target.value);
  $('#fill-color').onchange=e=>setStyle('backgroundColor',e.target.value);
  // One range gesture is one history entry, with a live canvas preview.
  let opacityBefore=null;
  $('#opacity').addEventListener('input',event=>{
    if(!opacityBefore)opacityBefore=snapshot();defaults.opacity=Number(event.target.value);const e=selectedElement();if(e)e.opacity=defaults.opacity;render();
  });
  $('#opacity').addEventListener('change',()=>{if(opacityBefore){commit(opacityBefore);opacityBefore=null;}render();});
  document.querySelectorAll('button[data-tool]').forEach(b=>b.onclick=()=>chooseTool(b.dataset.tool));
  $('#start-drawing').onclick=()=>chooseTool('rectangle');
  function removeSelected(){if(!selectedElement())return;edit(()=>{scene.elements=scene.elements.filter(e=>e.id!==selected);selected=null;});}
  $('#delete-button').onclick=removeSelected;$('#undo').onclick=()=>history();$('#redo').onclick=()=>history(true);
  function zoomTo(next){cancelGesture();const width=svg.clientWidth,height=svg.clientHeight;const center={x:camera.x+width/zoom/2,y:camera.y+height/zoom/2};zoom=Math.max(.25,Math.min(4,next));camera={x:center.x-width/zoom/2,y:center.y-height/zoom/2};render();}
  function fit(){const box=M.bounds(scene);if(!box){zoom=1;camera={x:0,y:0};render();return;}const left=svg.clientWidth>650?255:175,right=35,top=105,bottom=90;const width=Math.max(100,svg.clientWidth-left-right),height=Math.max(100,svg.clientHeight-top-bottom);zoom=Math.max(.1,Math.min(1,width/(box.width+40),height/(box.height+40)));camera={x:box.x+box.width/2-(left+width/2)/zoom,y:box.y+box.height/2-(top+height/2)/zoom};render();}
  $('#zoom-in').onclick=()=>zoomTo(zoom*1.25);$('#zoom-out').onclick=()=>zoomTo(zoom/1.25);$('#fit').onclick=fit;
  function closeMenu(){$('#file-menu').hidden=true;$('#menu-button').setAttribute('aria-expanded','false');}
  $('#menu-button').onclick=()=>{const opening=$('#file-menu').hidden;$('#file-menu').hidden=!opening;$('#menu-button').setAttribute('aria-expanded',opening);};
  document.addEventListener('pointerdown',event=>{if(!event.target.closest('#file-menu')&&!event.target.closest('#menu-button'))closeMenu();});
  function download(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);}
  function save(){cancelGesture();closeMenu();download(new Blob([M.serialize(scene)],{type:'application/json'}),`${baseName}.minidraw.json`);toast('MiniDraw 파일 다운로드를 요청했습니다.');}
  function open(){cancelGesture();closeMenu();$('#file-input').click();}
  $('#save-button').onclick=save;$('#open-button').onclick=open;
  $('#file-input').addEventListener('change',async event=>{
    const file=event.target.files[0];event.target.value='';if(!file)return;
    try{
      if(file.size>10*1024*1024)throw new Error('파일 크기는 10MB 이하여야 합니다.');
      const parsed=M.parse(await file.text());cancelGesture();const before=snapshot();scene=parsed.scene;selected=null;tool='select';baseName=file.name.replace(/(?:\.minidraw)?\.(json|excalidraw)$/i,'');commit(before);fit();
      toast(parsed.simplified?'파일을 열었습니다. 손그림 효과·그룹·잠금·링크는 적용하지 않습니다.':'파일을 열었습니다. 위치·크기·스타일을 복원했습니다.');
    }catch(error){toast(error.message);}
  });
  function updateExport(){
    document.querySelectorAll('[data-scale]').forEach(b=>b.setAttribute('aria-pressed',Number(b.dataset.scale)===exportScale));
    try{
      const box=M.dimensions(scene,exportScale);
      if(box.pixelWidth>16384||box.pixelHeight>16384||box.pixelWidth*box.pixelHeight>32e6)throw new Error('이미지가 너무 큽니다. 배율이나 도형 간격을 줄여주세요.');
      M.renderPNG(scene,1,$('#export-background').checked,$('#preview'));
      $('#preview').hidden=false;$('#export-size').textContent=`${box.pixelWidth} × ${box.pixelHeight} px · PNG`;$('#download-png').disabled=false;
    }catch(error){$('#preview').hidden=true;$('#export-size').textContent=error.message;$('#download-png').disabled=true;}
  }
  function showExport(){cancelGesture();closeMenu();if(!scene.elements.length){toast('먼저 사각형을 그려주세요.');return;}updateExport();$('#export-dialog').showModal();}
  $('#export-button').onclick=showExport;$('#menu-export').onclick=showExport;
  $('#export-background').onchange=updateExport;
  document.querySelectorAll('[data-scale]').forEach(b=>b.onclick=()=>{exportScale=Number(b.dataset.scale);updateExport();});
  $('#download-png').onclick=()=>{
    try{const canvas=M.renderPNG(scene,exportScale,$('#export-background').checked);canvas.toBlob(blob=>{if(!blob){toast('PNG 생성에 실패했습니다.');return;}download(blob,`${baseName}-${exportScale}x${$('#export-background').checked?'':'-transparent'}.png`);toast('PNG 다운로드를 요청했습니다.');},'image/png');}catch(error){toast(error.message);}
  };
  function help(){closeMenu();$('#help-dialog').showModal();}
  $('#help-button').onclick=help;$('#help-shortcut').onclick=help;
  $('#clear-button').onclick=()=>{closeMenu();if(!scene.elements.length)return;$('#clear-dialog').showModal();};
  $('#confirm-clear').onclick=()=>{edit(()=>{scene.elements=[];selected=null;});$('#clear-dialog').close();};
  document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>document.getElementById(b.dataset.close).close());
  document.addEventListener('keydown',event=>{
    if($('dialog[open]'))return;
    if(event.target.matches('textarea,input[type=text],input[type=number],select'))return;
    const key=event.key.toLowerCase(),mod=event.ctrlKey||event.metaKey;
    if(mod){
      if(key==='z'){event.preventDefault();history(event.shiftKey);}
      else if(key==='y'){event.preventDefault();history(true);}
      else if(key==='s'){event.preventDefault();save();}
      else if(key==='o'){event.preventDefault();open();}
      else if(key==='e'&&event.shiftKey){event.preventDefault();showExport();}
      return;
    }
    if(key==='escape'){cancelGesture();selected=null;tool='select';closeMenu();render();}
    else if(key==='delete'||key==='backspace'){event.preventDefault();removeSelected();}
    else if(key==='v'||key==='1')chooseTool('select');
    else if(key==='r'||key==='2')chooseTool('rectangle');
    else if(key==='h'||key==='3')chooseTool('hand');
    else if(key==='?')help();
  });
  window.addEventListener('resize',render);
  window.addEventListener('beforeunload',event=>{if(scene.elements.length){event.preventDefault();event.returnValue='';}});
  render();
})();
