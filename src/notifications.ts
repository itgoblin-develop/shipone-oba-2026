export async function enableNotifications() {
  if (!("Notification" in window) || !("serviceWorker" in navigator))
    throw new Error(
      "이 브라우저는 웹 알림을 지원하지 않습니다. 화면 속 도깨비 안내를 이용해주세요.",
    );
  const permission = await Notification.requestPermission();
  if (permission !== "granted")
    throw new Error(
      "알림 권한이 허용되지 않았습니다. 브라우저 사이트 설정에서 변경할 수 있습니다.",
    );
  await navigator.serviceWorker.register(new URL("./sw.js", location.href), {
    scope: "./",
  });
  await navigator.serviceWorker.ready;
  localStorage.setItem("shipone-notifications", "on");
  await sendNotification(
    "ShipOne 알림이 켜졌어요",
    "집중 시간이 끝나면 도깨비가 알려드릴게요.",
  );
}
export async function sendNotification(title: string, body: string) {
  if (
    !("Notification" in window) ||
    Notification.permission !== "granted" ||
    localStorage.getItem("shipone-notifications") !== "on"
  )
    return;
  const registration = await navigator.serviceWorker.getRegistration();
  if (registration)
    await registration.showNotification(title, {
      body,
      icon: "./shipone.svg",
      tag: "shipone-focus",
    });
}
