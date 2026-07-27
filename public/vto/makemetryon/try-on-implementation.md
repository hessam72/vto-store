Embed the widget in your page.
Embed the widget in your page using an iframe. Use the postMessage API to open the widget, load models, receive events, and exchange data with the parent page.

1
Embed the iframe
Add this to your page where the widget should appear. The public key is already included in the URL.

index.html
Copy
<iframe
  id="makemetryon-widget"
  src="https://widgets.makemetryon.com/vto-ring?key=public_key_********"
  allow="camera; microphone; autoplay; fullscreen"
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
API events
Send actions to the widget, or handle events it sends back.

Examples use your linked model · SKU replace_with_model_sku · model_id replace_with_model_id

Parent → Widget
open_widget
Opens the widget. Optionally provide sku or model_id to open a specific model. If omitted, the widget uses the model already configured in the iframe URL.

index.html
Copy
const iframe = document.getElementById('makemetryon-widget')
iframe.contentWindow.postMessage({ action: 'open_widget' }, '*')
iframe.contentWindow.postMessage({ action: 'open_widget', sku: 'replace_with_model_sku' }, '*')
iframe.contentWindow.postMessage({ action: 'open_widget', model_id: 'replace_with_model_id' }, '*')
Parent → Widget
Programmatic close
close_widget
Closes the widget programmatically. When using ?hud=true, listen for the close_widget event instead of sending this action after the user presses Close. Use this action only when your application needs to close the widget.

index.html
Copy
const iframe = document.getElementById('makemetryon-widget')
iframe.contentWindow.postMessage({ action: 'close_widget' }, '*')
Widget → Parent page
User closed
close_widget
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
Parent → Widget
by sku or model_id
load_model
Loads a different ring model without reloading the widget. Load by sku or model_id.

index.html
Copy
const iframe = document.getElementById('makemetryon-widget')
iframe.contentWindow.postMessage({ action: 'load_model', sku: 'replace_with_model_sku' }, '*')
iframe.contentWindow.postMessage({ action: 'load_model', model_id: 'replace_with_model_id' }, '*')