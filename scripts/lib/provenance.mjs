/**
 * provenance.mjs — is this dump from the Figma file this pipeline is for?
 *
 * Nothing else in the chain is addressed per client. The plugin reads whichever
 * file happens to be open and POSTs to a port; the sink writes to whichever repo
 * it is running in. So "KR's file open, Acme's sink listening" silently lands
 * KR's variables in Acme's repo — and the collection audit reports a happy 6/6,
 * because both files follow the convention. The file name is the only thing that
 * can tell them apart, and the plugin already sends it.
 *
 * Pure so it can be tested against every combination without standing up a
 * scaffolded clone. The CLI decides what to do with the verdict.
 */

/**
 * @param {object} args
 * @param {string|null|undefined} args.fetched   file name the dump carried
 * @param {string|null|undefined} args.expected  pipeline.config.mjs figmaFileName
 * @returns {{ ok: boolean, level: 'ok'|'warn'|'error', kind: string, lines: string[] }}
 *   `ok: false` means refuse. Anything else may proceed, possibly noisily.
 */
export function checkProvenance({ fetched, expected }) {
  if (!expected) {
    // The very first sync for a new client happens before anyone knows the file
    // name, so an unconfigured pipeline must stay usable — but say what it saw.
    return {
      ok: true, level: 'warn', kind: 'unconfigured',
      lines: [
        'pipeline.config.mjs has no figmaFileName — provenance unchecked.',
        ...(fetched ? [`This dump came from "${fetched}". Set figmaFileName to lock it.`] : []),
      ],
    };
  }

  if (!fetched) {
    return {
      ok: true, level: 'warn', kind: 'unknown-source',
      lines: ['this dump carries no file name — provenance unchecked.'],
    };
  }

  if (fetched !== expected) {
    return {
      ok: false, level: 'error', kind: 'wrong-file',
      lines: [
        'Wrong Figma file.',
        '',
        `  This dump came from : "${fetched}"`,
        `  This pipeline is for: "${expected}"`,
        '',
        '  Nothing has been written. Either the wrong file was open in Figma when you',
        '  pressed Sync, or a sink for a different client was listening on the port.',
        '  If the file was genuinely renamed, update figmaFileName in pipeline.config.mjs.',
      ],
    };
  }

  return {
    ok: true, level: 'ok', kind: 'match',
    lines: [`dump is from "${fetched}", matching pipeline.config.mjs`],
  };
}
