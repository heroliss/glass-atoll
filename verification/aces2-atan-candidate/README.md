# QA-only accurate atan2 candidate

This is a non-official numerical substitution in the OpenColorIO2.6.0 exported ACES2 shaders. Production HDR, look and defaults do not import it. Original files in ../aces2-oracle and the first52/53 report are unchanged.

Only the unique `atan(Aab.b, Aab.g)` call is replaced by a generic range-reduced degree17 atan2 function; the complete function exactly inverts to the sealed official source. CPU inputs/expected outputs and both hue tables are borrowed by relative paths without modification. `candidate-descriptor.js` records hashes and scope. The official export compatibility schema is retained only so the unchanged numerical probe can load these explicit candidate assets; it does not make this an official OCIO export or certification.

OCIO-LICENSE.txt covers the original OpenColorIO-derived shader text. See ../ACES2-ATAN-CANDIDATE-NOTES.md for gates, use and limitations.
