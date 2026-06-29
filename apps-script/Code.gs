/**
 * OpenYap Command Center — RFI Drive lister
 * Lists the RFI folder (and every subfolder, e.g. "Closed") and returns parsed
 * metadata as JSON for the Command Center web app. CC stores only the LINK
 * (viewUrl), never the PDF itself.
 *
 * Folder: https://drive.google.com/drive/folders/11gIk12vqz6cDkvPth776ihQjrsd9gJoR
 *   - top level          = active RFIs
 *   - "Closed" subfolder = the closed archive (~190 RFIs, the resolved/known-impact ones).
 *     Walked recursively and marked Closed.
 *
 * Deploy: Apps Script editor → Deploy → New deployment → Web app
 *   - Execute as: Me   ·   Who has access: Anyone (so the static site can fetch it)
 * Copy the /exec URL into index.html → RFI_API_URL, then push.
 */

var RFI_FOLDER_ID = '11gIk12vqz6cDkvPth776ihQjrsd9gJoR';

function doGet(e) {
  try {
    var root = DriveApp.getFolderById(RFI_FOLDER_ID);
    var byNum = {};                       // dedup by RFI number — keep the newest revision
    collect_(root, false, byNum);
    var out = Object.keys(byNum).map(function (k) { return byNum[k]; });
    out.sort(function (a, b) { return (b.number || '').localeCompare(a.number || '', undefined, { numeric: true }); });
    return json_(out);
  } catch (err) {
    return json_({ error: String(err) });
  }
}

// Walk a folder + its subfolders. folderClosed = somewhere under a "Closed"/"Void" folder.
function collect_(folder, folderClosed, byNum) {
  var files = folder.getFiles();
  while (files.hasNext()) {
    var f = files.next();
    if (f.getMimeType() !== 'application/pdf') continue;
    var title = f.getName();
    var num = parseNumber_(title);
    var rec = {
      number:   num,
      title:    parseSubject_(title),
      status:   parseStatus_(title, folderClosed),
      viewUrl:  f.getUrl(),
      modified: f.getLastUpdated().toISOString()
    };
    var key = baseNumber_(num);
    var prev = byNum[key];
    if (!prev || rec.modified > prev.modified) byNum[key] = rec;   // newest revision wins
  }
  var subs = folder.getFolders();
  while (subs.hasNext()) {
    var sf = subs.next();
    collect_(sf, folderClosed || /closed|void/i.test(sf.getName()), byNum);
  }
}

// RFI number incl. revision, normalized, e.g. "RFI-00248.0"
function parseNumber_(name) {
  var m = name.match(/RFI[-\s]?0*\d+(?:\.\d+)?/i);
  if (m) return m[0].replace(/\s+/g, '-').toUpperCase();
  return name.replace(/\.[^.]+$/, '').slice(0, 24);
}

// Bare integer ("248") used only for de-duplicating revisions of the same RFI.
function baseNumber_(num) {
  var m = String(num).match(/\d+/);
  return m ? String(parseInt(m[0], 10)) : String(num);
}

function parseStatus_(name, folderClosed) {
  if (folderClosed)                   return 'Closed';
  if (/closed|void(ed)?/i.test(name)) return 'Closed';
  if (/\banswered\b/i.test(name))     return 'Answered';
  if (/\bopen\b/i.test(name))         return 'Open';
  return 'Open';
}

function parseSubject_(name) {
  var s = name.replace(/\.[^.]+$/, '');                                   // drop extension
  s = s.replace(/^RFI[-\s]?0*\d+(?:\.\d+)?\s*[-–]?\s*/i, '');         // drop "RFI-00248.0 - "
  s = s.replace(/^(all|various)\s*[-–]\s*/i, '');                     // drop a leading "All - " scope tag
  s = s.replace(/\s*[-–]\s*(open|closed|answered|void(ed)?)\s*(package)?\s*$/i, ''); // trailing status/package
  s = s.replace(/\s*[-–]\s*package\s*$/i, '');
  s = s.replace(/\s*[-–]\s*$/, '').replace(/\s{2,}/g, ' ');           // tidy dangling separators
  return s.trim();
}

function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
