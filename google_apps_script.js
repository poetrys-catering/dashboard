// Google Apps Script API for Poetry's Catering - SECURE VERSION

const SCRIPT_PROP = PropertiesService.getScriptProperties();
const SECRET_KEY = SCRIPT_PROP.getProperty("SECRET_KEY") || "PoetrysCateringSecureKey2026"; // Fallback to original if not configured in Script Properties

function setup() {
  const doc = SpreadsheetApp.getActiveSpreadsheet();
  SCRIPT_PROP.setProperty("key", doc.getId());
}

// Token Generation & Verification
function generateToken(userObj) {
  const payloadStr = JSON.stringify({
    u: userObj.username,
    r: userObj.role,
    t: new Date().getTime()
  });
  const payload = Utilities.base64EncodeWebSafe(payloadStr);
  const signature = Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(payload, SECRET_KEY));
  return payload + "." + signature;
}

function verifyToken(token) {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const payload = parts[0];
  const signature = parts[1];
  
  const expectedSignature = Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(payload, SECRET_KEY));
  if (signature === expectedSignature) {
    try {
      const decodedStr = Utilities.newBlob(Utilities.base64DecodeWebSafe(payload)).getDataAsString();
      const decoded = JSON.parse(decodedStr);
      // Optional: Check expiration (e.g., 24 hours)
      if (new Date().getTime() - decoded.t > 24 * 60 * 60 * 1000) return null;
      return decoded;
    } catch (e) {
      return null;
    }
  }
  return null;
}

// FUNGSI INI HANYA UNTUK MEMANCING IZIN GOOGLE CALENDAR & URLFETCH
function authorizeCalendar() {
  const cal = CalendarApp.getDefaultCalendar();
  Logger.log("Calendar Name: " + cal.getName());
  UrlFetchApp.fetch("https://www.googleapis.com/calendar/v3/users/me/calendarList", {
    headers: { "Authorization": "Bearer " + ScriptApp.getOAuthToken() },
    muteHttpExceptions: true
  });
}

function doPost(e) {
  return handleResponse(e);
}

function doGet(e) {
  return handleResponse(e);
}

function syncToCalendar(sheetName, payload, oldEventId) {
  try {
    const calendar = CalendarApp.getDefaultCalendar();
    let title = "";
    let dateStr = "";
    let desc = "";

    if (sheetName === "Invoices") {
      if (!payload.cateringDate) return oldEventId;
      title = "Catering: " + (payload.customerName || "Unknown") + " - " + payload.invoiceNumber;
      dateStr = payload.cateringDate;
      let itemsStr = "";
      try {
        const items = typeof payload.items === 'string' ? JSON.parse(payload.items) : (payload.items || []);
        itemsStr = items.map(i => i.qty + "x " + i.name).join(", ");
      } catch(e){}
      desc = "Vendor: " + (payload.vendor || "") + "\\nLoc: " + (payload.cateringLocation || "") + "\\nItems: " + itemsStr;
    } else if (sheetName === "Schedules") {
      if (!payload.date) return oldEventId;
      title = (payload.type || "Schedule") + ": " + (payload.title || "Untitled");
      dateStr = payload.date;
      desc = "Loc: " + (payload.location || "") + "\\nNotes: " + (payload.notes || "");
    } else {
      return oldEventId;
    }

    let eventDate;
    let isAllDay = true;
    if (dateStr.includes('T') && dateStr.includes(':')) {
      eventDate = new Date(dateStr);
      isAllDay = false;
    } else {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        eventDate = new Date(parts[0], parseInt(parts[1])-1, parts[2]);
      }
    }
    if (!eventDate || isNaN(eventDate.getTime())) return oldEventId;
    let event;

    if (oldEventId) {
      try {
        event = calendar.getEventById(oldEventId);
        if (event) {
          event.setTitle(title);
          if (isAllDay) {
            event.setAllDayDate(eventDate);
          } else {
            const endTime = new Date(eventDate.getTime() + 60 * 60 * 1000);
            event.setTime(eventDate, endTime);
          }
          event.setDescription(desc);
          return oldEventId;
        }
      } catch(e) {}
    }

    if (isAllDay) {
      event = calendar.createAllDayEvent(title, eventDate, {description: desc});
    } else {
      const endTime = new Date(eventDate.getTime() + 60 * 60 * 1000);
      event = calendar.createEvent(title, eventDate, endTime, {description: desc});
    }
    return event.getId();

  } catch(e) {
    return oldEventId;
  }
}

function deleteCalendarEvent(eventId) {
  if (!eventId) return;
  try {
    const calendar = CalendarApp.getDefaultCalendar();
    const event = calendar.getEventById(eventId);
    if (event) event.deleteEvent();
  } catch(e) {}
}

function getCalendarShares() {
  try {
    const aclList = Calendar.Acl.list("primary");
    if (aclList && aclList.items) {
      const shares = aclList.items.filter(function(item) {
        return item.role !== 'owner' && item.scope && item.scope.type === 'user';
      }).map(function(item) {
        return {
          id: item.id,
          email: item.scope.value,
          role: item.role
        };
      });
      return shares;
    }
  } catch (e) {
    throw new Error("Gagal mengambil data sharing kalender. Harap tambahkan 'Google Calendar API' di panel kiri (Services) editor Google Apps Script terlebih dahulu.");
  }
  return [];
}

function shareCalendar(email, role) {
  try {
    const resource = {
      role: role || "writer",
      scope: {
        type: "user",
        value: email
      }
    };
    return Calendar.Acl.insert(resource, "primary");
  } catch (e) {
    throw new Error("Gagal membagikan kalender. Pastikan email benar dan 'Google Calendar API' sudah ditambahkan di panel kiri (Services).");
  }
}

function unshareCalendar(ruleId) {
  try {
    Calendar.Acl.remove("primary", ruleId);
    return { status: "success" };
  } catch (e) {
    throw new Error("Gagal menghapus sharing kalender. Pastikan 'Google Calendar API' sudah ditambahkan di panel kiri (Services).");
  }
}

function handleResponse(e) {
  const action = e.parameter.action;

  // === PING: Test endpoint to verify this version of code is deployed ===
  if (action === 'PING') {
    return ContentService.createTextOutput(JSON.stringify({
      status: 'ok',
      version: 'v2-with-guest-invoice',
      message: 'Apps Script berjalan dengan benar. GET_GUEST_INVOICE tersedia.'
    })).setMimeType(ContentService.MimeType.JSON);
  }

  const isWriteAction = ["ADD_ROW", "UPDATE_ROW", "DELETE_ROW"].includes(action);
  
  const lock = LockService.getScriptLock();
  if (isWriteAction) {
    lock.tryLock(10000);
  }

  try {
    const doc = SpreadsheetApp.getActiveSpreadsheet();

    // Ensure 'allowedmenus' header exists in Users sheet
    const usersSheet = doc.getSheetByName("Users");
    if (usersSheet) {
      const headers = usersSheet.getRange(1, 1, 1, usersSheet.getLastColumn()).getValues()[0];
      const allowedMenusIdx = headers.indexOf("allowedmenus");
      if (allowedMenusIdx === -1) {
        usersSheet.getRange(1, headers.length + 1).setValue("allowedmenus");
      }
    }

    // Column migrations are handled manually in the spreadsheet.

    // === CALENDAR SHARING ACTIONS ===
    if (action === "GET_CALENDAR_SHARES") {
      const shares = getCalendarShares();
      return ContentService.createTextOutput(JSON.stringify({ status: "success", data: shares }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    if (action === "SHARE_CALENDAR") {
      const email = e.parameter.email;
      const result = shareCalendar(email, "writer");
      if (result.error) {
        return ContentService.createTextOutput(JSON.stringify({ status: "error", message: result.error.message }))
          .setMimeType(ContentService.MimeType.JSON);
      }
      return ContentService.createTextOutput(JSON.stringify({ status: "success", data: result }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    if (action === "UNSHARE_CALENDAR") {
      const ruleId = e.parameter.ruleId;
      const result = unshareCalendar(ruleId);
      return ContentService.createTextOutput(JSON.stringify({ status: "success", data: result }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // === LOGIN ACTION ===
    if (action === "LOGIN") {
      const payload = JSON.parse(e.postData.contents);
      const username = payload.username;
      const passwordHash = payload.password; // Expected to be hashed from frontend
      
      // Bootstrapped local superadmin check
      if (username === "superadmin" && passwordHash === "e34f92a20532a873cb3184398070b4b82a8fa29cf48572c203dc5f0fa6158231") {
        const userObj = {
          id: "superadmin_bootstrapped",
          username: "superadmin",
          role: "super admin",
          name: "Super Admin"
        };
        const token = generateToken(userObj);
        return ContentService.createTextOutput(JSON.stringify({ status: "success", token: token, user: userObj }))
          .setMimeType(ContentService.MimeType.JSON);
      }

      const sheet = doc.getSheetByName("Users");
      if (!sheet) throw new Error("Users sheet not found");
      const data = sheet.getDataRange().getValues();
      const headers = data[0];
      const userIdx = headers.indexOf("username");
      const passIdx = headers.indexOf("password");
      const roleIdx = headers.indexOf("role");
      const nameIdx = headers.indexOf("name");
      const idIdx = headers.indexOf("id");
      const allowedMenusIdx = headers.indexOf("allowedmenus");
      
      for (let i = 1; i < data.length; i++) {
        if (data[i][userIdx] === username && data[i][passIdx] === passwordHash) {
          const userObj = {
            id: data[i][idIdx],
            username: data[i][userIdx],
            role: data[i][roleIdx],
            name: nameIdx > -1 ? data[i][nameIdx] : "",
            allowedmenus: allowedMenusIdx > -1 ? data[i][allowedMenusIdx] : ""
          };
          const token = generateToken(userObj);
          return ContentService.createTextOutput(JSON.stringify({ status: "success", token: token, user: userObj }))
            .setMimeType(ContentService.MimeType.JSON);
        }
      }
      return ContentService.createTextOutput(JSON.stringify({ status: "error", message: "Invalid username or password" }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // === AUTHORIZATION CHECK FOR PROTECTED ACTIONS ===
    let user = null;
    const protectedActions = ["GET_INIT_DATA", "GET_ALL", "ADD_ROW", "UPDATE_ROW", "DELETE_ROW"];
    if (protectedActions.includes(action)) {
      // Token can be in URL parameter or JSON payload
      let token = e.parameter.token;
      if (!token && e.postData && e.postData.contents) {
        try {
          const payload = JSON.parse(e.postData.contents);
          if (payload.token) token = payload.token;
        } catch (err) {}
      }
      
      user = verifyToken(token);
      if (!user) {
        return ContentService.createTextOutput(JSON.stringify({ status: "error", message: "Unauthorized. Invalid or expired token." }))
          .setMimeType(ContentService.MimeType.JSON);
      }
    }

    if (action === "GET_GUEST_INVOICE") {
      const invNum = e.parameter.invoiceNumber;
      const vendorInput = e.parameter.vendor || e.parameter.phone;
      
      if (!vendorInput) {
        return ContentService.createTextOutput(JSON.stringify({ status: "error", message: "Verification required. Please provide your Vendor Name." }))
          .setMimeType(ContentService.MimeType.JSON);
      }
      
      const sheet = doc.getSheetByName("Invoices");
      if (!sheet) throw new Error("Invoices sheet not found");
      const data = sheet.getDataRange().getValues();
      const headers = data[0];
      const invNumIdx = headers.indexOf("invoiceNumber");
      const vendorIdx = headers.indexOf("vendor");
      
      for (let i = 1; i < data.length; i++) {
        if (data[i][invNumIdx] == invNum) {
          const dbVendor = String(data[i][vendorIdx] || '').trim().toLowerCase();
          const inputVendor = String(vendorInput).trim().toLowerCase();
          
          if (dbVendor === inputVendor && inputVendor !== '') {
            const rowData = {};
            for (let j = 0; j < headers.length; j++) {
              rowData[headers[j]] = data[i][j];
            }
            return ContentService.createTextOutput(JSON.stringify({ status: "success", data: rowData }))
              .setMimeType(ContentService.MimeType.JSON);
          } else {
            return ContentService.createTextOutput(JSON.stringify({ status: "error", message: "Nama Vendor verifikasi salah. Akses ditolak." }))
              .setMimeType(ContentService.MimeType.JSON);
          }
        }
      }
      return ContentService.createTextOutput(JSON.stringify({ status: "error", message: "Invoice tidak ditemukan." }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // === CREATE SHORT LINK: Store compact invoice data, return 6-char code ===
    if (action === "CREATE_SHORT_LINK") {
      const payload = e.parameter.data || '';
      if (!payload) {
        return ContentService.createTextOutput(JSON.stringify({ status: "error", message: "No data provided" }))
          .setMimeType(ContentService.MimeType.JSON);
      }
      // Get or create ShortLinks sheet
      let sheet = doc.getSheetByName("ShortLinks");
      if (!sheet) {
        sheet = doc.insertSheet("ShortLinks");
        sheet.appendRow(["code", "data", "created"]);
      }
      // Generate unique 6-char alphanumeric code
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
      let code = '';
      for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
      sheet.appendRow([code, payload, new Date().toISOString()]);
      return ContentService.createTextOutput(JSON.stringify({ status: "success", code: code }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // === GET SHORT LINK: Retrieve invoice data by short code ===
    if (action === "GET_SHORT_LINK") {
      const code = e.parameter.code;
      const sheet = doc.getSheetByName("ShortLinks");
      if (!sheet) {
        return ContentService.createTextOutput(JSON.stringify({ status: "error", message: "ShortLinks tidak ditemukan" }))
          .setMimeType(ContentService.MimeType.JSON);
      }
      const data = sheet.getDataRange().getValues();
      for (let i = 1; i < data.length; i++) {
        if (data[i][0] === code) {
          return ContentService.createTextOutput(JSON.stringify({ status: "success", data: data[i][1] }))
            .setMimeType(ContentService.MimeType.JSON);
        }
      }
      return ContentService.createTextOutput(JSON.stringify({ status: "error", message: "Link tidak ditemukan atau sudah kadaluarsa" }))
        .setMimeType(ContentService.MimeType.JSON);
    }


    if (action === "GET_INIT_DATA") {
      const sheetsToFetch = ["Menus", "Invoices", "Schedules"];
      if (user.r === 'super admin') sheetsToFetch.push("Users"); // Only super admin gets Users data
      
      const resultData = {};

      sheetsToFetch.forEach(sheetName => {
        const sheet = doc.getSheetByName(sheetName);
        if (sheet) {
          const data = sheet.getDataRange().getValues();
          const headers = data[0];
          const rows = [];
          for (let i = 1; i < data.length; i++) {
            const rowData = {};
            for (let j = 0; j < headers.length; j++) {
              // Obfuscate passwords even for admin, just in case
              if (sheetName === "Users" && headers[j] === "password") {
                rowData[headers[j]] = "********"; 
              } else {
                rowData[headers[j]] = data[i][j];
              }
            }
            rows.push(rowData);
          }
          resultData[sheetName] = rows;
        } else {
          resultData[sheetName] = [];
        }
      });

      // Retrieve fresh profile and permissions for the requesting user
      const usersSheet = doc.getSheetByName("Users");
      if (usersSheet) {
        const usersData = usersSheet.getDataRange().getValues();
        const usersHeaders = usersData[0];
        const uIdx = usersHeaders.indexOf("username");
        const roleIdx = usersHeaders.indexOf("role");
        const nameIdx = usersHeaders.indexOf("name");
        const idIdx = usersHeaders.indexOf("id");
        const allowedMenusIdx = usersHeaders.indexOf("allowedmenus");
        
        for (let i = 1; i < usersData.length; i++) {
          if (usersData[i][uIdx] === user.u) {
            resultData["currentUser"] = {
              id: usersData[i][idIdx],
              username: usersData[i][uIdx],
              role: usersData[i][roleIdx],
              name: nameIdx > -1 ? usersData[i][nameIdx] : "",
              allowedmenus: allowedMenusIdx > -1 ? usersData[i][allowedMenusIdx] : ""
            };
            break;
          }
        }
      }

      return ContentService.createTextOutput(JSON.stringify({ status: "success", data: resultData }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    if (action === "GET_ALL") {
      const sheetName = e.parameter.sheet;
      if (sheetName === "Users" && user.r !== 'super admin') {
        throw new Error("Unauthorized to access Users");
      }
      
      const sheet = doc.getSheetByName(sheetName);
      if (!sheet) throw new Error("Sheet not found");

      const data = sheet.getDataRange().getValues();
      const headers = data[0];
      const rows = [];
      
      for (let i = 1; i < data.length; i++) {
        const rowData = {};
        for (let j = 0; j < headers.length; j++) {
          if (sheetName === "Users" && headers[j] === "password") {
             rowData[headers[j]] = "********";
          } else {
             rowData[headers[j]] = data[i][j];
          }
        }
        rows.push(rowData);
      }
      return ContentService.createTextOutput(JSON.stringify({ status: "success", data: rows }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    if (action === "ADD_ROW") {
      const sheetName = e.parameter.sheet;
      if (sheetName === "Users" && user.r !== 'super admin') throw new Error("Unauthorized");
      
      const sheet = doc.getSheetByName(sheetName);
      if (!sheet) throw new Error("Sheet not found");

      const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
      const nextRow = sheet.getLastRow() + 1;
      const newRow = [];

      const payload = JSON.parse(e.postData.contents);
      
      if (sheetName === "Invoices" || sheetName === "Schedules") {
        const eventId = syncToCalendar(sheetName, payload, null);
        if (eventId) {
          payload.eventid = eventId;
        }
      }
      
      for (let i = 0; i < headers.length; i++) {
        const header = headers[i];
        newRow.push(payload[header] !== undefined ? payload[header] : "");
      }

      sheet.getRange(nextRow, 1, 1, newRow.length).setValues([newRow]);
      return ContentService.createTextOutput(JSON.stringify({ status: "success", message: "Row added", data: payload }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    if (action === "DELETE_ROW") {
      const sheetName = e.parameter.sheet;
      if (sheetName === "Users" && user.r !== 'super admin') throw new Error("Unauthorized");
      
      const sheet = doc.getSheetByName(sheetName);
      if (!sheet) throw new Error("Sheet not found");

      const id = e.parameter.id;
      const data = sheet.getDataRange().getValues();
      const headers = data[0];
      
      for (let i = 1; i < data.length; i++) {
        if (data[i][0] == id) { 
          if (sheetName === "Invoices" || sheetName === "Schedules") {
            const eventIdIndex = headers.indexOf("eventid");
            if (eventIdIndex > -1 && data[i][eventIdIndex]) {
              deleteCalendarEvent(data[i][eventIdIndex]);
            }
          }
          
          sheet.deleteRow(i + 1);
          return ContentService.createTextOutput(JSON.stringify({ status: "success", message: "Row deleted" }))
            .setMimeType(ContentService.MimeType.JSON);
        }
      }
      throw new Error("Row not found");
    }

    if (action === "UPDATE_ROW") {
      const sheetName = e.parameter.sheet;
      const payload = JSON.parse(e.postData.contents);
      
      // Only super admin can update Users, UNLESS user is updating their own profile
      if (sheetName === "Users" && user.r !== 'super admin') {
         // Check if user is updating their own profile
         if (payload.username !== user.u) throw new Error("Unauthorized to update other users");
      }
      
      const sheet = doc.getSheetByName(sheetName);
      if (!sheet) throw new Error("Sheet not found");

      const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
      const id = payload.id;
      
      const data = sheet.getDataRange().getValues();
      for (let i = 1; i < data.length; i++) {
        if (data[i][0] == id) { 
          if (sheetName === "Invoices" || sheetName === "Schedules") {
            const eventIdIndex = headers.indexOf("eventid");
            let oldEventId = eventIdIndex > -1 ? data[i][eventIdIndex] : null;
            if (payload.eventid) oldEventId = payload.eventid;
            
            const newEventId = syncToCalendar(sheetName, payload, oldEventId);
            if (newEventId) payload.eventid = newEventId;
          }

          const newRow = [];
          for (let j = 0; j < headers.length; j++) {
            // Keep existing value if payload doesn't provide it, EXCEPT for password where empty string means keep existing
            let val = payload[headers[j]];
            if (val === undefined) {
               val = data[i][j];
             } else if (sheetName === "Users" && headers[j] === "password" && (val === "" || val === "********")) {
                val = data[i][j]; // keep old password
             }
            newRow.push(val);
          }
          sheet.getRange(i + 1, 1, 1, newRow.length).setValues([newRow]);
          return ContentService.createTextOutput(JSON.stringify({ status: "success", message: "Row updated", data: payload }))
            .setMimeType(ContentService.MimeType.JSON);
        }
      }
      throw new Error("Row not found");
    }

    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: "Invalid action" }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  } finally {
    if (isWriteAction) {
      lock.releaseLock();
    }
  }
}
