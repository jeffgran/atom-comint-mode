'use babel';

var provider = {
  // TODO don't know why '.comint-mode' doesn't work here..
  selector: '*',
  
  inclusionPriority: 2,
  excludeLowerPriority: true,
  
  getSuggestions: function({editor, bufferPosition, scopeDescriptor, prefix}) {
    console.log("in autocomplete provider", prefix);
    var cb = editor.comintBuffer;
    return cb.bashAutoComplete(prefix);
  }
  
};

export default provider;