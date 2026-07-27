1
Embed the iframe
Add this to your page where the widget should appear. The public key is already included in the URL.

index.html

Copy
<iframe
  id="makemetryon-widget"
  src="https://widgets.makemetryon.com/viewer-jewelry?key=public_key_j89s6n7"
  allow="fullscreen"
  sandbox="allow-scripts allow-same-origin">
</iframe>
2
Wire up the parent page
Reference the iframe and listen for widget events. With ?hud=true, handle close_widget here when the user taps Close. Extend the handler for each event you need below.

index.html

Copy
const iframe = document.getElementById('makemetryon-widget')

window.addEventListener('message', (event) => {
  if (event.source !== iframe.contentWindow) return

  const { action, type, payload } = event.data ?? {}

  if (action === 'close_widget') {
    // With ?hud=true — user tapped Close; hide your modal or overlay
  }
})
How messages flow
All communication uses window.postMessage().

Messages sent from the parent page control the widget.

Messages sent from the widget notify your application about events or request data.

With ?hud=true on the iframe URL, the widget sends close_widget when the user taps Close — handle it in your message listener to hide your modal or overlay.

Parent page
→
Widget
open_widget
Widget
→
Parent page
close_widget
For production, use your widget's exact origin instead of "*" when calling postMessage, and validate event.origin when receiving messages.

API events
Send actions to the widget, or handle events it sends back.

Examples use your linked model · model_id 6a3d8873fb1a429400729030

open_widget
Parent → Widget
Opens the widget. Optionally provide sku or model_id to open a specific model. If omitted, the widget uses the model already configured in the iframe URL.

index.html

Copy
iframe.contentWindow.postMessage({ action: 'open_widget' }, '*')
iframe.contentWindow.postMessage({ action: 'open_widget', sku: 'sku-your-product' }, '*')
iframe.contentWindow.postMessage({ action: 'open_widget', model_id: '6a3d8873fb1a429400729030' }, '*')
close_widget
Programmatic close
Parent → Widget
Closes the widget programmatically. When using ?hud=true, listen for the close_widget event instead of sending this action after the user presses Close. Use this action only when your application needs to close the widget.

index.html

Copy
iframe.contentWindow.postMessage({ action: 'close_widget' }, '*')
close_widget
User closed
Widget → Parent
When the user clicks Close in the widget HUD, the widget stops itself and posts { action: 'close_widget' } to the parent. Hide your modal, drawer, or overlay after receiving this event. Do not send close_widget back to the iframe.

index.html

Copy
// addEventListener('message', …) for close_widget:
// Widget posts: { action: 'close_widget' }
window.addEventListener('message', (event) => {
  if (event.source !== iframe.contentWindow) return
  if (event.data?.action === 'close_widget') {
    // Hide your modal, drawer, or overlay
  }
})
load_model
by sku or model_id
Parent → Widget
Loads a different jewelry model without reloading the widget. Load by sku or model_id.

index.html

Copy
iframe.contentWindow.postMessage({ action: 'load_model', sku: 'sku-your-product' }, '*')
iframe.contentWindow.postMessage({ action: 'load_model', model_id: '6a3d8873fb1a429400729030' }, '*')
pause_widget
Parent → Widget
Pause the 3D render loop without disposing resources. Useful when the tab is hidden.

index.html

Copy
iframe.contentWindow.postMessage({ action: 'pause_widget' }, '*')
resume_widget
Parent → Widget
Resume rendering after pause_widget.

index.html

Copy
iframe.contentWindow.postMessage({ action: 'resume_widget' }, '*')