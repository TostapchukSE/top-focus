use tauri_plugin_autostart::MacosLauncher;

#[cfg(target_os = "macos")]
use objc::{msg_send, sel, sel_impl};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_autostart::init(
            MacosLauncher::LaunchAgent,
            Some(vec![]),
        ))
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_positioner::init())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            // --- macOS NSPanel behavior (WIN-02, WIN-03) ---
            #[cfg(target_os = "macos")]
            {
                use tauri::Manager;
                let window = app.get_webview_window("main").expect("main window not found");

                // Access the raw NSWindow pointer via Tauri's macOS private API
                let ns_window = window.ns_window().expect("failed to get ns_window");
                let ns_window = ns_window as *mut objc::runtime::Object;

                unsafe {
                    // --- Non-activating panel behavior (WIN-02) ---
                    // NSWindowStyleMask.nonactivatingPanel = 1 << 7 = 128
                    let current_mask: u64 = msg_send![ns_window, styleMask];
                    let non_activating_panel: u64 = 1 << 7;
                    let new_mask = current_mask | non_activating_panel;
                    let _: () = msg_send![ns_window, setStyleMask: new_mask];

                    // --- Visible on all Spaces (WIN-03) ---
                    // canJoinAllSpaces = 1 << 0 = 1
                    // stationary = 1 << 4 = 16 (prevents sliding during Space transitions)
                    // fullScreenAuxiliary = 1 << 8 = 256
                    let can_join_all_spaces: u64 = 1 << 0;
                    let stationary: u64 = 1 << 4;
                    let full_screen_auxiliary: u64 = 1 << 8;
                    let behavior = can_join_all_spaces | stationary | full_screen_auxiliary;
                    let _: () = msg_send![ns_window, setCollectionBehavior: behavior];

                    // --- Reinforce floating window level ---
                    // NSWindow.Level.floating = 3
                    let floating_level: i64 = 3;
                    let _: () = msg_send![ns_window, setLevel: floating_level];
                }
            }

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
