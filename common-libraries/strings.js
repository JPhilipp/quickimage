export function toName(name) {
  return String(name).toLowerCase().replace(/ /g, '_').replace(/[^a-z0-9_-]/g, '');
}

export function toFileName(name) {
  return toName(name);
}

export function toFolderName(name) {
  return toName(name);
}

export function shortenString(text, maxLength = 100, suffixIfShortened = "...") {
  if (!text) { return ''; }
  text = String(text);

  // Ensure we don't cut through a multi-byte character
  const characters = Array.from(text);
  if (characters.length > maxLength) {
    text = characters.slice(0, maxLength - suffixIfShortened.length).join('') + suffixIfShortened;
  }
  
  return text;
}

export function stringCanBeInt(text) {
  let num = Number(text);
  return Number.isInteger(num);
}

export function capitalizeFirstLetter(text) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function removeIndents(text) {
  let lines = text.split('\n');

  if (lines[0].trim() === '') {
    lines.shift();
  }
  if (lines[lines.length - 1].trim() === '') {
    lines.pop();
  }

  let minIndent = lines.reduce((min, line) => {
    if (line.trim() === '') {
      return min; // skip entirely blank lines
    }
    let currentIndent = line.match(/^ */)[0].length;
    return Math.min(min, currentIndent);
  }, Infinity);

  return lines.map(line => line.slice(minIndent)).join('\n');
}

export function replaceFalselyEncodedCharacters(text) {
  text = text.replace(/\\u00e4/g, 'ä');
  text = text.replace(/\\u00f6/g, 'ö');
  text = text.replace(/\\u00fc/g, 'ü');
  text = text.replace(/\\u00df/g, 'ß');
  text = text.replace(/\\u00c4/g, 'Ä');
  text = text.replace(/\\u00d6/g, 'Ö');
  text = text.replace(/\\u00dc/g, 'Ü');
  
  text = text.replace(/{ exta}/g, 'ä');
  text = text.replace(/{ exto}/g, 'ö');
  text = text.replace(/{ extu}/g, 'ü');
  text = text.replace(/{ extsz}/g, 'ß');
  text = text.replace(/{ extA}/g, 'Ä');
  text = text.replace(/{ extO}/g, 'Ö');
  text = text.replace(/{ extU}/g, 'Ü');

  text = text.replace(/&auml;/g, 'ä');
  text = text.replace(/&ouml;/g, 'ö');
  text = text.replace(/&uuml;/g, 'ü');
  text = text.replace(/&szlig;/g, 'ß');
  text = text.replace(/&Auml;/g, 'Ä');
  text = text.replace(/&Ouml;/g, 'Ö');
  text = text.replace(/&Uuml;/g, 'Ü');

  text = text.replace(/&\#228;/g, 'ä');
  text = text.replace(/&\#246;/g, 'ö');
  text = text.replace(/&\#252;/g, 'ü');
  text = text.replace(/&\#223;/g, 'ß');
  text = text.replace(/&\#196;/g, 'Ä');
  text = text.replace(/&\#214;/g, 'Ö');
  text = text.replace(/&\#220;/g, 'Ü');

  text = text.replace(/Ã¤/g, 'ä');
  text = text.replace(/Ã¶/g, 'ö');
  text = text.replace(/Ã¼/g, 'ü');
  text = text.replace(/Ã/g, 'Ä');
  text = text.replace(/Ã–/g, 'Ö');
  text = text.replace(/Ãœ/g, 'Ü');
  text = text.replace(/ÃŸ/g, 'ß');

  return text;
}

export function escapeHTML(text) {
  if (!text) { return ''; }
  text = String(text);
  var map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, function (m) { return map[m]; });
}

export function replaceQuotes(text) {
  return text.replace(/"/g, "'");
}

export function insertBetween(text, startText, endText, textToInsert) {
  const startTextIndex = text.indexOf(startText);
  const endTextIndex   = text.indexOf(endText);
  
  if (startTextIndex >= 0 && endTextIndex > startTextIndex) {
    text = text.substring(0, startTextIndex + startText.length) +
      textToInsert +
      text.substring(endTextIndex);
  }

  return text;
}

export function removeSquareBrackets(text) {
  if (text) {
    text = String(text);
    text = text.replace(/\[|\]/g, '');
  }
  return text;
}
