'use babel';

var provider = {
  selector: '.comint',
  
  inclusionPriority: 2,
  excludeLowerPriority: true,
  
  getSuggestions: function({editor, bufferPosition, scopeDescriptor, prefix}) {
    console.log("in autocomplete provider", prefix);
    var cb = editor.comintBuffer;
    return cb.bashAutoComplete(prefix);
  }
  
};

export default provider;