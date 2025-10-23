## 배포 가이드 (Ubuntu 서버)

이 문서는 Ubuntu (22.04 권장) 서버에 `service_car_simulator`를 배포하는 기본 절차를 설명합니다.

요약 단계
- 서버 준비: Node.js LTS, nginx, certbot, pm2 설치
- 리포지토리 클론 또는 파일 업로드
- 환경 변수 설정(.env)
- pm2로 앱 실행
- nginx 리버스 프록시 구성 및 SSL 설정 (certbot)

1) 서버에 필요한 소프트웨어 설치
   - 로컬에서 제공된 `scripts/setup_ubuntu_server.sh`를 사용: sudo bash scripts/setup_ubuntu_server.sh

2) 리포지토리 배치
   - 권장 경로: /var/www/service_car_simulator
   - 예: sudo git clone https://your-repo-url /var/www/service_car_simulator

3) 앱 설정
   - 프로젝트 루트에 `.env` 파일을 생성하거나 `.env.example`을 복사하세요.
   - 기본 노출 포트는 `PORT`(기본 5000)입니다.

4) 배포 및 시작
   - 서버에서: cd /var/www/service_car_simulator; sudo bash scripts/deploy.sh
   - 또는 수동으로: npm ci --only=production; pm2 start server.js --name service-car-simulator

5) nginx 설정
   - 예시: `deploy/nginx_example.conf`를 참조하여 `/etc/nginx/sites-available/service_car_simulator`로 복사합니다.
   - 심볼릭 링크 생성: ln -s /etc/nginx/sites-available/service_car_simulator /etc/nginx/sites-enabled/
   - nginx 테스트 및 재시작: nginx -t; systemctl restart nginx

6) SSL 설정 (Let's Encrypt)
   - certbot --nginx -d yourdomain.com

7) 로그 및 프로세스 관리
   - pm2 status
   - pm2 logs service-car-simulator
   - pm2 startup && pm2 save

## 자동 배포 (GitHub Actions)

원격 서버와 연동하여 `main` 브랜치에 푸시하면 자동으로 서버에 배포되도록 GitHub Actions 예시 워크플로를 제공합니다.

필요한 설정 (GitHub 저장소에서 Settings → Secrets):
- `DEPLOY_SSH_KEY`: 서버 접속에 사용할 개인 SSH 키(PEM 내용). 권한을 적절히 설정하세요.
- `DEPLOY_HOST`: 서버 호스트 (예: `3.39.24.148`)

동작 방식 요약:
- GitHub Actions가 코드를 체크아웃한 뒤, 제공된 SSH 키로 서버에 rsync로 파일을 복사합니다.
- 복사 후 서버에 SSH로 접속해 `scripts/deploy.sh`를 실행하도록 합니다.

보안 주의:
- SSH 키는 비공개로 관리해야 하며, 가능한 한 deploy 전용 키를 만들어 권한을 제한하세요.
- GitHub Secrets에 잘못된 키나 호스트를 넣지 마세요. 자동으로 실행되므로 배포 전에 테스트 환경에서 검증하세요.
문제 해결
- 포트 충돌: 앱이 바인딩하는 포트가 이미 사용 중인지 확인하세요 (ss -tulpn | grep 5000)
- 파일 권한: /var/www/service_car_simulator의 소유자와 권한을 확인하세요
