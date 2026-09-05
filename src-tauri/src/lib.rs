use std::fs;
use std::net::UdpSocket;
use std::sync::{Arc, Mutex};
use tauri::State;
use tiny_http::{Header, Response, Server, StatusCode};

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
pub struct Note {
    pub id: String,
    pub title: String,
    pub body: String,
}

pub struct AppState {
    pub notes: Mutex<Vec<Note>>,
}

#[tauri::command]
fn get_notes(state: State<Arc<AppState>>) -> Vec<Note> {
    state.notes.lock().unwrap().clone()
}

#[tauri::command]
fn create_note(state: State<Arc<AppState>>, title: String, body: String) -> String {
    let mut notes = state.notes.lock().unwrap();
    let id = uuid::Uuid::new_v4().to_string();
    let new_note = Note { id: id.clone(), title, body };
    notes.insert(0, new_note);
    id
}

#[tauri::command]
fn update_note(state: State<Arc<AppState>>, id: String, title: String, body: String) -> Result<(), String> {
    let mut notes = state.notes.lock().unwrap();
    if let Some(note) = notes.iter_mut().find(|n| n.id == id) {
        note.title = title;
        note.body = body;
        Ok(())
    } else {
        Err("Not bulunamadý".into())
    }
}

#[tauri::command]
fn delete_note(state: State<Arc<AppState>>, id: String) -> Result<(), String> {
    let mut notes = state.notes.lock().unwrap();
    notes.retain(|n| n.id != id);
    Ok(())
}

#[tauri::command]
fn get_local_ip() -> String {
    let socket = match UdpSocket::bind("0.0.0.0:0") {
        Ok(s) => s,
        Err(_) => return "127.0.0.1".to_string(),
    };
    if socket.connect("8.8.8.8:80").is_ok() {
        if let Ok(addr) = socket.local_addr() {
            return addr.ip().to_string();
        }
    }
    "127.0.0.1".to_string()
}

#[tauri::command]
fn save_file_dialog(default_name: String, content: String, ext_name: String, extension: String) -> Result<bool, String> {
    let file_path = rfd::FileDialog::new()
        .set_file_name(&default_name)
        .add_filter(&ext_name, &[&extension])
        .save_file();

    if let Some(path) = file_path {
        fs::write(path, content).map_err(|e| e.to_string())?;
        Ok(true)
    } else {
        Ok(false)
    }
}

#[tauri::command]
fn sync_webdav(state: State<Arc<AppState>>) -> Result<String, String> {
    let notes = state.notes.lock().unwrap().clone();
    let client = reqwest::blocking::Client::new();
    
    let remote_notes: Vec<Note> = match client.get("http://127.0.0.1:8080/notes.json").send() {
        Ok(res) if res.status().is_success() => res.json().unwrap_or_default(),
        _ => Vec::new(),
    };

    let mut merged_map = std::collections::HashMap::new();
    for note in remote_notes {
        merged_map.insert(note.id.clone(), note);
    }
    for note in notes {
        merged_map.insert(note.id.clone(), note);
    }

    let merged_notes: Vec<Note> = merged_map.into_values().collect();

    let json_data = serde_json::to_string(&merged_notes).map_err(|e| e.to_string())?;
    let res = client.put("http://127.0.0.1:8080/notes.json")
        .body(json_data)
        .send()
        .map_err(|e| e.to_string())?;

    if res.status().is_success() {
        *state.notes.lock().unwrap() = merged_notes;
        Ok("Senkronizasyon baþarýlý!".to_string())
    } else {
        Err(format!("Sunucu hatasý: {}", res.status()))
    }
}

#[tauri::command]
fn restore_from_webdav(state: State<Arc<AppState>>) -> Result<String, String> {
    let client = reqwest::blocking::Client::new();
    let res = client.get("http://127.0.0.1:8080/notes.json")
        .send()
        .map_err(|e| e.to_string())?;

    if res.status().is_success() {
        let remote_notes: Vec<Note> = res.json().map_err(|e| e.to_string())?;
        *state.notes.lock().unwrap() = remote_notes;
        Ok("Yedekten baþarýyla yüklendi!".to_string())
    } else {
        Err("Yedek dosyasý bulunamadý!".to_string())
    }
}

fn start_webdav_server(app_state: Arc<AppState>) {
    std::thread::spawn(move || {
        let server = Server::http("0.0.0.0:8080").unwrap();

        for mut request in server.incoming_requests() {
            let method = request.method().as_str().to_string();
            let url = request.url().to_string();

            let cors_headers = vec![
                Header::from_bytes(&b"Access-Control-Allow-Origin"[..], &b"*"[..]).unwrap(),
                Header::from_bytes(&b"Access-Control-Allow-Methods"[..], &b"GET, PUT, POST, DELETE, OPTIONS, PROPFIND"[..]).unwrap(),
                Header::from_bytes(&b"Access-Control-Allow-Headers"[..], &b"Content-Type, Authorization, Depth"[..]).unwrap(),
            ];

            if method == "OPTIONS" {
                let mut response = Response::empty(StatusCode(200));
                for h in cors_headers { response.add_header(h); }
                let _ = request.respond(response);
                continue;
            }

            if url == "/notes.json" || url == "/" {
                match method.as_str() {
                    "GET" => {
                        let notes = app_state.notes.lock().unwrap().clone();
                        let json = serde_json::to_string(&notes).unwrap_or_default();
                        let mut response = Response::from_string(json);
                        response.add_header(Header::from_bytes(&b"Content-Type"[..], &b"application/json"[..]).unwrap());
                        for h in cors_headers { response.add_header(h); }
                        let _ = request.respond(response);
                    }
                    "PUT" | "POST" => {
                        let mut body = String::new();
                        if request.as_reader().read_to_string(&mut body).is_ok() {
                            if let Ok(new_notes) = serde_json::from_str::<Vec<Note>>(&body) {
                                *app_state.notes.lock().unwrap() = new_notes;
                            }
                        }
                        let mut response = Response::from_string("OK");
                        for h in cors_headers { response.add_header(h); }
                        let _ = request.respond(response);
                    }
                    _ => {
                        let mut response = Response::empty(StatusCode(405));
                        for h in cors_headers { response.add_header(h); }
                        let _ = request.respond(response);
                    }
                }
            } else {
                let mut response = Response::empty(StatusCode(404));
                for h in cors_headers { response.add_header(h); }
                let _ = request.respond(response);
            }
        }
    });
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let initial_notes = vec![
        Note {
            id: "1".to_string(),
            title: "Welcome".to_string(),
            body: "<p>PicoNote uygulamasýna Welcome!</p>".to_string(),
        }
    ];

    let app_state = Arc::new(AppState {
        notes: Mutex::new(initial_notes),
    });

    start_webdav_server(app_state.clone());

    tauri::Builder::default()
        .manage(app_state)
        .invoke_handler(tauri::generate_handler![
            get_notes,
            create_note,
            update_note,
            delete_note,
            sync_webdav,
            restore_from_webdav,
            get_local_ip,
            save_file_dialog
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
