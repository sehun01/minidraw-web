# MiniDraw를 GitHub Pages에 공개하기

이 폴더는 Git 저장소이며, `index.html`이 루트에 있습니다. Excalidraw 원본 코드나 패키지를 사용하지 않습니다.

## GitHub에서 빈 저장소 만들기

1. GitHub에 로그인하고 **New repository**를 선택합니다.
2. 이름을 `minidraw`로 지정하고 **Public**으로 만듭니다. Pages 공개 주소를 만들려면 공개 저장소가 간편합니다.
3. README, .gitignore, 라이선스를 추가하는 초기화 옵션은 선택하지 않습니다. 이 폴더에 이미 README가 있습니다.
4. 생성 후 표시되는 저장소 주소 `https://github.com/사용자명/minidraw.git`을 복사합니다.

## 로컬 폴더 연결하기

PowerShell에서 이 폴더로 이동한 뒤 아래 명령을 실행합니다. `사용자명`을 본인 GitHub 이름으로 바꿉니다. Git이 커밋 작성자 이름과 이메일을 요구하면 실제 본인 정보를 `git config user.name "이름"` 및 `git config user.email "이메일"`로 **이 저장소에만** 설정합니다.

```powershell
git add .
git commit -m "Add MiniDraw"
git remote add origin https://github.com/사용자명/minidraw.git
git push -u origin main
```

GitHub Desktop을 쓰는 경우 **File → Add local repository**로 이 폴더를 선택하고, 커밋 후 **Publish repository**를 선택해도 됩니다.

## 웹사이트 주소 만들기

저장소의 **Settings → Pages**에서 **Build and deployment → Source**를 **Deploy from a branch**로, 브랜치를 **main**, 폴더를 **/(root)**로 선택하고 저장합니다. 배포가 끝나면 주소는 보통 `https://사용자명.github.io/minidraw/` 형식입니다. 실제 주소는 Pages 화면에서 확인하세요.

MiniDraw의 브라우저 파일 열기와 PNG 다운로드는 방문자 기기에서 처리됩니다. Pages에 올린 뒤 사각형을 그려 보고 파일 저장·불러오기와 PNG 출력을 다시 확인하세요.

공식 안내: [저장소 연결](https://docs.github.com/en/get-started/git-basics/managing-remote-repositories), [Pages 배포 설정](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site).
