'use strict';
let reEditing = false;
let reSaving = false;
let reEditingModelString = null;
let reEditingUuid = null;
let reEditingName = null;

module.exports = {
  load () {
    // 当 package 被正确加载的时候执行
    //console.log("behaviortree-editor loaded");
  },

  unload () {
    // 当 package 被正确卸载的时候执行
    //console.log("behaviortree-editor unloaded");
  },

  messages: {
    'test' (e,arg){
      Editor.log(arg);
      Editor.log(Editor.metas);
    },

    're-open-by-comp' (e,arg) {
      if(reEditing){
          Editor.Dialog.messageBox ({
            type:"none",
            buttons: ["shut up"],
            title:"tips",
            message: "you are locked in re-editing mode.",
            detail:"leave the re-editing mode and try again. maybe you should save first."
          },function(){});

      return};
      reEditing = true;
      Editor.Panel.open("behaviortree-editor");
      //Editor.Ipc.sendToPanel('behaviortree-editor','load-data',);
        //Editor.log(arg.uuid);
        Editor.Ipc.sendToMain("asset-db:query-path-by-uuid",arg.uuid,function(e,result){
        //Editor.log(e);
        //Editor.log(result);
          let fs_handler = require('fs');
          fs_handler.readFile(result, "utf-8", function(err, data) {
            //Editor.log(data);
            let modelString= data.match(/\/\/#########################################.*#############################################/)[0].replace(/#*/g,"").replace(/^\/\//,"");
            reEditingModelString = modelString;
            reEditingUuid = arg.uuid;
            reEditingName = arg.name;
            //Editor.log(reEditingName);
            //Editor.log(modelData);
            //Editor.Ipc.sendToPanel("behaviortree-editor","re-modify-by-comp",{modelString:modelString,uuid:arg.uuid});
            //require('electron').ipcMain.send('behaviortree-editor:re-modify-by-comp',{modelString:modelString,uuid:arg.uuid});
            //Editor.log(Editor.Ipc);
          });
        });
    },
    'load-data-of-comp' (e,arg){
      if(!reEditing){Editor.Dialog.messageBox ({
            type:"none",
            buttons: ["shut up"],
            title:"tips",
            message: "you are not in re-editing mode",
            detail:"you can enter the re-editing mode from behaviortree-Component."
          },function(){});
          e.reply(null,{error: true});
      }else{
          if(reSaving){Editor.log(Editor.Dialog.messageBox ({
            type:"none",
            buttons: ["shut up"],
            title:"tips",
            message: "please wait the temp saving",
            detail:"after saving, you can load from lasteat saved data if in re-editing mode."
          },function(){}));e.reply(null,{error:true})}
          else{
            e.reply(null,{error: false, reEditingModelString:reEditingModelString, reEditingName: reEditingName});
          }
      }
      
    },
    'leave-re-editing-mode' (e){
      reEditing = false;
      Editor.log(Editor.Dialog.messageBox ({
            type:"none",
            buttons: ["shut up"],
            title:"tips",
            message: "you leave re-editing mode",
            detail:"in new mode the file would saved as default way.and just close the edit-panel would not leave re-editing mode."
          },function(){}));e.reply(null,{error:true})
      e.reply(null,{});
    },

    'open' () {
      Editor.Panel.open("behaviortree-editor");
    },
    'receive-json' (e,arg) {
    let modelAsObj =  arg;
      //console.log(modelAsObj);
      let nodeDataArray = modelAsObj.nodeDataArray;

       let getNodeByType = function(type){
          for(let node of nodeDataArray){
            if(node.type == type){
              return node;
            }
          }
       };

       let getNodesByParentKey = function(key){
         let nodes = [];
         for(let node of nodeDataArray){
           if(node.parent!== undefined && node.parent == key){
             nodes.push(node);
           }
         }
         return nodes;
       };

       let orderFromTopToDown = function(a,b){
          let ay = a.loc.split(" ")[1];
          let by = b.loc.split(" ")[1];
          //Editor.log(ay,by,(ay - by) | 0);
          return (ay - by) | 0;
       }

        let rootNode = getNodeByType("Root");

       let generateTreeLayerString = function(parentNode,childNodes){
          let children =  [];
          for(let childNode of childNodes){
              if(childNode.name == childNode.type){
                 children.push("new b3." + childNode.type + "(" + "##key" + childNode.key +"##" +")");
              }else{
                 children.push("new " + childNode.name + "(" +"##key" + childNode.key +"##"+ ")");
              }
              // if(childNode.parameter){
              //   console.log(childNode.parameter.replace(/\"/g,"'"));
              // }
          }
          let tempParameter = JSON.parse(parentNode.parameter);
          let resultObj = {};
          resultObj.parameter = parentNode.parameter.replace(/"/g,"'");
          switch(parentNode.type){
            case 'Limiter':
            case 'RepeaterUntilFailure':
            case 'RepeaterUntilSuccess':
            case 'Repeater':{resultObj.maxLoop = tempParameter.maxLoop; break;}
          }
          switch(parentNode.type){
            case 'MaxTime': {resultObj.maxTime = rtempParameter.maxTime; break;}
          }
          switch(parentNode.type){
            case 'Wait': {resultObj.milliseconds = tempParameter.milliseconds; break;}
          }
          switch(parentNode.catagory){
            case 'Composite': {resultObj.children = children; break;}
          }
          switch(parentNode.catagory){
            case 'Decorator': {resultObj.child = children[0]; break;}
          }

          return JSON.stringify(resultObj);
       }



       let nodeQuene = [];
       nodeQuene.push(rootNode);
       let finalString = "new b3.Sequence(##key" + rootNode.key +"##)";
       while(nodeQuene.length != 0){
           let node = nodeQuene.shift();
           let childNodes = getNodesByParentKey(node.key);
           let orderedChildNodes = childNodes.sort(orderFromTopToDown);
           nodeQuene = nodeQuene.concat(orderedChildNodes);
           let gString = generateTreeLayerString(node,orderedChildNodes);
           finalString = finalString.replace("##key"+node.key+"##",gString);
       }
       //console.log(finalString);

    let customNodeString = "let self = this;\n";
    let hasGeneratedNodes = [];
    for(let node of nodeDataArray){
      if(hasGeneratedNodes[node.name] != undefined){continue;}
      if(node.name != node.type || node.type == 'Action' || node.type == 'Condition' || node.type == 'Composite' || node.type == 'Decorator'){
            hasGeneratedNodes[node.name] = true;
            customNodeString += "let  "+node.name+" = b3.Class(b3."+node.type+");\n" + 
                                node.name+".prototype.name = '"+node.name+"';\n" + 
                                node.name+".prototype.__"+node.catagory+"_initialize = "+node.name+".prototype.initialize;\n" + 
                                node.name+".prototype.initialize = function(settings){\n" + 
                                "         settings = settings || {};\n" + 
                                "         this.__"+node.catagory+"_initialize();\n" + 
                                "         this.parameter = settings.parameter;\n";
                                 switch(node.type){
                                  case 'Limiter':
                                  case 'RepeaterUntilFailure':
                                  case 'RepeaterUntilSuccess':
                                  case 'Repeater':{customNodeString += "this.maxLoop = settings.maxLoop;\n";break;}
                                }
                                switch(node.type){
                                  case 'MaxTime': {customNodeString += "this.maxTime = settings.maxTime;\n";break;}
                                }
                                switch(node.type){
                                  case 'Wait': {customNodeString += "this.milliseconds = settings.milliseconds;\n";break;}
                                }
                                switch(node.catagory){
                                  case 'Composite': {customNodeString += "this.children = settings.children;\n";break;}
                                }
                                switch(node.catagory){
                                  case 'Decorator': {customNodeString += "this.child = settings.child;\n";break;}
                                }
            customNodeString += "}\n" + 
                                node.name+".prototype.enter = function(tick){\n" + 
                                "           return self.getComponent('"+node.name+"').enter(tick,b3,this);\n" + 
                                "}\n" + 
                                node.name+".prototype.open = function(tick) {\n" +
                                "           return self.getComponent('"+node.name+"').open(tick,b3,this);\n" + 
                                "}\n" + 
                                node.name+".prototype.tick = function(tick) {\n" +
                                "           return self.getComponent('"+node.name+"').tick(tick,b3,this);\n" + 
                                "}\n" + 
                                node.name+".prototype.close = function(tick) {\n" +
                                "           return self.getComponent('"+node.name+"').close(tick,b3,this);\n" + 
                                "}\n" + 
                                node.name+".prototype.exit = function(tick) {\n" +
                                "           return self.getComponent('"+node.name+"').exit(tick,b3,this);\n" + 
                                "}\n";
      }
    }
    let tipsString = "//Don't modify this if you want to re-modify the behaviortree in the future\n";
    let modelString = "//#########################################" + JSON.stringify(modelAsObj) + "#############################################\n";

    let mainString = tipsString + 
    modelString + 
    "\n" + 
    "\n" + 
    "cc.Class({\n" + 
    "extends: cc.Component,\n" +
    "editor: {\n" + 
    "inspector: 'packages://behaviortree-editor/bt-inspector.js'\n"+
    "},\n" + 
    "properties: {\n" +
    "},\n" + 
    "onLoad: function () {\n" + 
    "let b3 = require('b3core.0.1.0module');\n"+
    customNodeString + 
    "let tree = new b3.BehaviorTree();\n"+
    "tree.root = " + finalString.replace(/"/g,"") + ";\n"+
    "this.tree = tree;\n"+
    "this.blackboard = new b3.Blackboard();\n" + 
    "this.b3 = b3;\n" + 
    "},\n" +
    "tick: function(target){\n"+
    "let t = {};\n" + 
    "if(target != undefined){t = target;}\n" +
    "this.tree.tick(t,this.blackboard)\n" + 
    "}" + 
    "});\n";

    //console.log(mainString);
    let fs_handler = require("fs");
    if(reEditing){
      Editor.Ipc.sendToMain("asset-db:query-url-by-uuid",reEditingUuid,function(e,result){
        fs_handler.writeFileSync(Editor.url(result),mainString);
        Editor.Ipc.sendToMain("asset-db:refresh",result,function(err,results){
          reSaving = true;
          fs_handler.readFile(Editor.url(result), "utf-8", function(err, data) {
            
            let modelString= data.match(/\/\/#########################################.*#############################################/)[0].replace(/#*/g,"").replace(/^\/\//,"");
            reEditingModelString = modelString;
            reSaving = false;
            Editor.log(Editor.Dialog.messageBox ({
            type:"none",
            buttons: ["shut up"],
            title:"tips",
            message: "file of re-edit saved",
            detail:"you could see something blink blink in assetdb. take care of the component name."
          },function(){}));
          });
        });
      });
    }
    else{
    //生成行为树组件脚本
        fs_handler.writeFileSync(Editor.url("db://assets/BehaviorTree.js"),mainString);
        Editor.Ipc.sendToMain("asset-db:refresh","db://assets/BehaviorTree.js",function(err,results){
          Editor.log(Editor.Dialog.messageBox ({
            type:"none",
            buttons: ["shut up"],
            title:"tips",
            message: "file of new saved",
            detail:"you could see something new(maybe) in assetdb. take care of the component name."
          },function(){}));
        });
    }
    
    },

    'add-lib' () {
       let fs_handler = require("fs");
       fs_handler.writeFileSync(Editor.url("db://assets/b3core.0.1.0module.js"), fs_handler.readFileSync(Editor.url("packages://behaviortree-editor/b3core.0.1.0module.js")));
       Editor.Ipc.sendToMain("asset-db:refresh","db://assets/b3core.0.1.0module.js",function(err,results){
         Editor.log(Editor.Dialog.messageBox ({
            type:"none",
            buttons: ["shut up"],
            title:"tips",
            message: "behaviortree lib added",
            detail:"even though the lib name is ugly, but don't modify it please."
          },function(){}));
       });
    },

    'generate-tree-node-template' (){
      let mainString = "cc.Class({\n" + 
    "extends: cc.Component,\n" + 
    "\n" + 
    "properties: {\n" + 
    "\n" + 
    "},\n" + 
    "\n" + 
    "\n" +         
    "onLoad: function () {\n" + 
      "\n" + 
    "},\n" +
    "enter: function(tick,b3,treeNode){\n" + 
        "\n" + 
    "},\n"+
    "open: function(tick,b3,treeNode){\n" + 
       "\n"+ 
    "},\n" + 
    "tick: function(tick,b3,treeNode){\n" + 
        "\n"+
    "},\n" +
    "close: function(tick,b3,treeNode){\n" + 
        "\n" + 
    "},\n" + 
    "exit: function(tick,b3,treeNode){\n" + 
        "\n" +
    "},\n" +
      "\n" + 
    "});\n"; 

    let fs_handler = require("fs");
       fs_handler.writeFileSync(Editor.url("db://assets/TreeNodeTemplate.js"), mainString);
       Editor.Ipc.sendToMain("asset-db:refresh","db://assets/TreeNodeTemplate.js",function(err,results){
         Editor.log(Editor.Dialog.messageBox ({
            type:"none",
            buttons: ["shut up"],
            title:"tips",
            message: "treenode code template generated",
            detail:"look more about the code and the src in behaviortree lib to get more tips"
          },function(){}));
       });
    },

  },

};