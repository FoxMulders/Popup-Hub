#!/usr/bin/env node
/**
 * Patches ios/App/App.xcodeproj/project.pbxproj to add WidgetBridge + widget extension.
 * Re-run after cap sync if the widget target disappears.
 */
import fs from 'node:fs'
import path from 'node:path'

const pbxPath = path.join(process.cwd(), 'ios/App/App.xcodeproj/project.pbxproj')
if (!fs.existsSync(pbxPath)) {
  console.error('Missing', pbxPath)
  process.exit(1)
}

let pbx = fs.readFileSync(pbxPath, 'utf8')
if (pbx.includes('PopupHubWidgetExtension')) {
  console.log('PopupHubWidgetExtension already present — skipping')
  process.exit(0)
}

const ids = {
  bridgeFile: 'W1DGE0011FED796500168601',
  bridgeBuild: 'W1DGE0021FED796500168601',
  widgetGroup: 'W1DGE0031FED796500168601',
  widgetSwift: 'W1DGE0041FED796500168601',
  feedSwift: 'W1DGE0051FED796500168601',
  intentsSwift: 'W1DGE0061FED796500168601',
  widgetPlist: 'W1DGE0071FED796500168601',
  widgetEnt: 'W1DGE0081FED796500168601',
  widgetSwiftBuild: 'W1DGE0091FED796500168601',
  feedSwiftBuild: 'W1DGE00A1FED796500168601',
  intentsSwiftBuild: 'W1DGE00B1FED796500168601',
  widgetPlistBuild: 'W1DGE00C1FED796500168601',
  appexProduct: 'W1DGE00D1FED796500168601',
  extTarget: 'W1DGE00E1FED796500168601',
  extSources: 'W1DGE00F1FED796500168601',
  extResources: 'W1DGE0101FED796500168601',
  extFrameworks: 'W1DGE0111FED796500168601',
  embedPhase: 'W1DGE0121FED796500168601',
  embedBuild: 'W1DGE0131FED796500168601',
  dependency: 'W1DGE0141FED796500168601',
  containerProxy: 'W1DGE0151FED796500168601',
  extDebug: 'W1DGE0161FED796500168601',
  extRelease: 'W1DGE0171FED796500168601',
  extConfigList: 'W1DGE0181FED796500168601',
}

pbx = pbx.replace(
  '/* End PBXBuildFile section */',
  `\t\t${ids.bridgeBuild} /* WidgetBridgePlugin.swift in Sources */ = {isa = PBXBuildFile; fileRef = ${ids.bridgeFile} /* WidgetBridgePlugin.swift */; };
\t\t${ids.widgetSwiftBuild} /* PopupHubWidget.swift in Sources */ = {isa = PBXBuildFile; fileRef = ${ids.widgetSwift} /* PopupHubWidget.swift */; };
\t\t${ids.feedSwiftBuild} /* WidgetFeedClient.swift in Sources */ = {isa = PBXBuildFile; fileRef = ${ids.feedSwift} /* WidgetFeedClient.swift */; };
\t\t${ids.intentsSwiftBuild} /* WidgetIntents.swift in Sources */ = {isa = PBXBuildFile; fileRef = ${ids.intentsSwift} /* WidgetIntents.swift */; };
\t\t${ids.embedBuild} /* PopupHubWidgetExtension.appex in Embed Foundation Extensions */ = {isa = PBXBuildFile; fileRef = ${ids.appexProduct} /* PopupHubWidgetExtension.appex */; settings = {ATTRIBUTES = (RemoveHeadersOnCopy, ); }; };
/* End PBXBuildFile section */`
)

pbx = pbx.replace(
  '/* End PBXFileReference section */',
  `\t\t${ids.bridgeFile} /* WidgetBridgePlugin.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = WidgetBridge/WidgetBridgePlugin.swift; sourceTree = "<group>"; };
\t\t${ids.widgetSwift} /* PopupHubWidget.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = PopupHubWidget.swift; sourceTree = "<group>"; };
\t\t${ids.feedSwift} /* WidgetFeedClient.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = WidgetFeedClient.swift; sourceTree = "<group>"; };
\t\t${ids.intentsSwift} /* WidgetIntents.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = WidgetIntents.swift; sourceTree = "<group>"; };
\t\t${ids.widgetPlist} /* Info.plist */ = {isa = PBXFileReference; lastKnownFileType = text.plist.xml; path = Info.plist; sourceTree = "<group>"; };
\t\t${ids.widgetEnt} /* PopupHubWidget.entitlements */ = {isa = PBXFileReference; lastKnownFileType = text.plist.entitlements; path = PopupHubWidget.entitlements; sourceTree = "<group>"; };
\t\t${ids.appexProduct} /* PopupHubWidgetExtension.appex */ = {isa = PBXFileReference; explicitFileType = "wrapper.app-extension"; includeInIndex = 0; path = PopupHubWidgetExtension.appex; sourceTree = BUILT_PRODUCTS_DIR; };
/* End PBXFileReference section */`
)

// Attach WidgetBridgePlugin.swift to the App group. Anchor on the AppDelegate.swift
// child reference (single line, ends with a comma) so this stays robust if cap sync
// reorders surrounding entries — a fragile multi-line anchor previously orphaned the
// file, making Xcode resolve it to the wrong path ("Build input files cannot be found").
{
  const bridgeChild = `\t\t\t${ids.bridgeFile} /* WidgetBridgePlugin.swift */,`
  const appDelegateChild = `\t\t\t504EC3071FED79650016851F /* AppDelegate.swift */,`
  if (!pbx.includes(bridgeChild)) {
    if (!pbx.includes(appDelegateChild)) {
      console.error('patch-ios-widget: could not find AppDelegate.swift group anchor')
      process.exit(1)
    }
    pbx = pbx.replace(appDelegateChild, `${appDelegateChild}\n${bridgeChild}`)
  }
}

pbx = pbx.replace(
  `\t\t\t504EC3041FED79650016851F /* App.app */,
\t\t\t);`,
  `\t\t\t504EC3041FED79650016851F /* App.app */,
\t\t\t\t${ids.appexProduct} /* PopupHubWidgetExtension.appex */,
\t\t\t);`
)

// Attach the PopupHubWidget group to the main project group. Anchor on the App group's
// child reference (single line, ends with a comma) so it survives cap sync reordering.
// If this group is left orphaned, its `path = ../PopupHubWidget` never applies and the
// widget's Swift files resolve to ios/App/<file> instead of ios/PopupHubWidget/<file>.
{
  const widgetGroupChild = `\t\t\t${ids.widgetGroup} /* PopupHubWidget */,`
  const appGroupChild = `\t\t\t504EC3061FED79650016851F /* App */,`
  if (!pbx.includes(widgetGroupChild)) {
    if (!pbx.includes(appGroupChild)) {
      console.error('patch-ios-widget: could not find App group anchor in main group')
      process.exit(1)
    }
    pbx = pbx.replace(appGroupChild, `${appGroupChild}\n${widgetGroupChild}`)
  }
}

pbx = pbx.replace(
  '/* End PBXGroup section */',
  `\t\t${ids.widgetGroup} /* PopupHubWidget */ = {
\t\t\tisa = PBXGroup;
\t\t\tchildren = (
\t\t\t\t${ids.widgetSwift} /* PopupHubWidget.swift */,
\t\t\t\t${ids.feedSwift} /* WidgetFeedClient.swift */,
\t\t\t\t${ids.intentsSwift} /* WidgetIntents.swift */,
\t\t\t\t${ids.widgetPlist} /* Info.plist */,
\t\t\t\t${ids.widgetEnt} /* PopupHubWidget.entitlements */,
\t\t\t);
\t\t\tpath = ../PopupHubWidget;
\t\t\tsourceTree = "<group>";
\t\t};
/* End PBXGroup section */`
)

pbx = pbx.replace(
  `\t\t\tbuildPhases = (
\t\t\t\t6634F4EFEBD30273BCE97C65 /* [CP] Check Pods Manifest.lock */,
\t\t\t\t504EC3001FED79650016851F /* Sources */,
\t\t\t\t504EC3011FED79650016851F /* Frameworks */,
\t\t\t\t504EC3021FED79650016851F /* Resources */,
\t\t\t\t9592DBEFFC6D2A0C8D5DEB22 /* [CP] Embed Pods Frameworks */,
\t\t\t);
\t\t\tbuildRules = (
\t\t\t);
\t\t\tdependencies = (
\t\t\t);`,
  `\t\t\tbuildPhases = (
\t\t\t\t6634F4EFEBD30273BCE97C65 /* [CP] Check Pods Manifest.lock */,
\t\t\t\t504EC3001FED79650016851F /* Sources */,
\t\t\t\t504EC3011FED79650016851F /* Frameworks */,
\t\t\t\t504EC3021FED79650016851F /* Resources */,
\t\t\t\t9592DBEFFC6D2A0C8D5DEB22 /* [CP] Embed Pods Frameworks */,
\t\t\t\t${ids.embedPhase} /* Embed Foundation Extensions */,
\t\t\t);
\t\t\tbuildRules = (
\t\t\t);
\t\t\tdependencies = (
\t\t\t\t${ids.dependency} /* PBXTargetDependency */,
\t\t\t);`
)

pbx = pbx.replace(
  '/* End PBXNativeTarget section */',
  `\t\t${ids.extTarget} /* PopupHubWidgetExtension */ = {
\t\t\tisa = PBXNativeTarget;
\t\t\tbuildConfigurationList = ${ids.extConfigList} /* Build configuration list for PBXNativeTarget "PopupHubWidgetExtension" */;
\t\t\tbuildPhases = (
\t\t\t\t${ids.extSources} /* Sources */,
\t\t\t\t${ids.extFrameworks} /* Frameworks */,
\t\t\t\t${ids.extResources} /* Resources */,
\t\t\t);
\t\t\tbuildRules = (
\t\t\t);
\t\t\tdependencies = (
\t\t\t);
\t\t\tname = PopupHubWidgetExtension;
\t\t\tproductName = PopupHubWidgetExtension;
\t\t\tproductReference = ${ids.appexProduct} /* PopupHubWidgetExtension.appex */;
\t\t\tproductType = "com.apple.product-type.app-extension";
\t\t};
/* End PBXNativeTarget section */`
)

pbx = pbx.replace(
  `\t\t\ttargets = (
\t\t\t\t504EC3031FED79650016851F /* App */,
\t\t\t);`,
  `\t\t\ttargets = (
\t\t\t\t504EC3031FED79650016851F /* App */,
\t\t\t\t${ids.extTarget} /* PopupHubWidgetExtension */,
\t\t\t);`
)

pbx = pbx.replace(
  `\t\t\tfiles = (
\t\t\t\t504EC3081FED79650016851F /* AppDelegate.swift in Sources */,
\t\t\t);`,
  `\t\t\tfiles = (
\t\t\t\t504EC3081FED79650016851F /* AppDelegate.swift in Sources */,
\t\t\t\t${ids.bridgeBuild} /* WidgetBridgePlugin.swift in Sources */,
\t\t\t);`
)

pbx = pbx.replace(
  '/* End PBXSourcesBuildPhase section */',
  `\t\t${ids.extSources} /* Sources */ = {
\t\t\tisa = PBXSourcesBuildPhase;
\t\t\tbuildActionMask = 2147483647;
\t\t\tfiles = (
\t\t\t\t${ids.widgetSwiftBuild} /* PopupHubWidget.swift in Sources */,
\t\t\t\t${ids.feedSwiftBuild} /* WidgetFeedClient.swift in Sources */,
\t\t\t\t${ids.intentsSwiftBuild} /* WidgetIntents.swift in Sources */,
\t\t\t);
\t\t\trunOnlyForDeploymentPostprocessing = 0;
\t\t};
/* End PBXSourcesBuildPhase section */`
)

pbx = pbx.replace(
  '/* End PBXResourcesBuildPhase section */',
  `\t\t${ids.extResources} /* Resources */ = {
\t\t\tisa = PBXResourcesBuildPhase;
\t\t\tbuildActionMask = 2147483647;
\t\t\tfiles = (
\t\t\t);
\t\t\trunOnlyForDeploymentPostprocessing = 0;
\t\t};
/* End PBXResourcesBuildPhase section */`
)

pbx = pbx.replace(
  '/* End PBXFrameworksBuildPhase section */',
  `\t\t${ids.extFrameworks} /* Frameworks */ = {
\t\t\tisa = PBXFrameworksBuildPhase;
\t\t\tbuildActionMask = 2147483647;
\t\t\tfiles = (
\t\t\t);
\t\t\trunOnlyForDeploymentPostprocessing = 0;
\t\t};
/* End PBXFrameworksBuildPhase section */`
)

pbx = pbx.replace(
  '/* End PBXShellScriptBuildPhase section */',
  `\t\t${ids.embedPhase} /* Embed Foundation Extensions */ = {
\t\t\tisa = PBXCopyFilesBuildPhase;
\t\t\tbuildActionMask = 2147483647;
\t\t\tdstPath = "";
\t\t\tdstSubfolderSpec = 13;
\t\t\tfiles = (
\t\t\t\t${ids.embedBuild} /* PopupHubWidgetExtension.appex in Embed Foundation Extensions */,
\t\t\t);
\t\t\tname = "Embed Foundation Extensions";
\t\t\trunOnlyForDeploymentPostprocessing = 0;
\t\t};
/* End PBXShellScriptBuildPhase section */`
)

if (!pbx.includes('Begin PBXContainerItemProxy section')) {
  pbx = pbx.replace(
    '/* End PBXCopyFilesBuildPhase section */',
    `/* End PBXCopyFilesBuildPhase section */

/* Begin PBXContainerItemProxy section */
/* End PBXContainerItemProxy section */`
  )
}

pbx = pbx.replace(
  '/* End PBXContainerItemProxy section */',
  `\t\t${ids.containerProxy} /* PBXContainerItemProxy */ = {
\t\t\tisa = PBXContainerItemProxy;
\t\t\tcontainerPortal = 504EC2FC1FED79650016851F /* Project object */;
\t\t\tproxyType = 1;
\t\t\tremoteGlobalIDString = ${ids.extTarget};
\t\t\tremoteInfo = PopupHubWidgetExtension;
\t\t};
/* End PBXContainerItemProxy section */`
)

if (!pbx.includes('Begin PBXTargetDependency section')) {
  pbx = pbx.replace(
    '/* End PBXContainerItemProxy section */',
    `/* End PBXContainerItemProxy section */

/* Begin PBXTargetDependency section */
/* End PBXTargetDependency section */`
  )
}

pbx = pbx.replace(
  '/* End PBXTargetDependency section */',
  `\t\t${ids.dependency} /* PBXTargetDependency */ = {
\t\t\tisa = PBXTargetDependency;
\t\t\ttarget = ${ids.extTarget} /* PopupHubWidgetExtension */;
\t\t\ttargetProxy = ${ids.containerProxy} /* PBXContainerItemProxy */;
\t\t};
/* End PBXTargetDependency section */`
)

pbx = pbx.replace(
  '/* End XCBuildConfiguration section */',
  `\t\t${ids.extDebug} /* Debug */ = {
\t\t\tisa = XCBuildConfiguration;
\t\t\tbuildSettings = {
\t\t\t\tCODE_SIGN_ENTITLEMENTS = ../PopupHubWidget/PopupHubWidget.entitlements;
\t\t\t\tCODE_SIGN_STYLE = Automatic;
\t\t\t\tCURRENT_PROJECT_VERSION = 11;
\t\t\t\tDEVELOPMENT_TEAM = 6ACBDTX7T7;
\t\t\t\tINFOPLIST_FILE = ../PopupHubWidget/Info.plist;
\t\t\t\tIPHONEOS_DEPLOYMENT_TARGET = 17.0;
\t\t\t\tLD_RUNPATH_SEARCH_PATHS = "$(inherited) @executable_path/Frameworks @executable_path/../../Frameworks";
\t\t\t\tMARKETING_VERSION = 1.120.0;
\t\t\t\tPRODUCT_BUNDLE_IDENTIFIER = ca.popuphub.app.PopupHubWidget;
\t\t\t\tPRODUCT_NAME = "$(TARGET_NAME)";
\t\t\t\tSKIP_INSTALL = YES;
\t\t\t\tSWIFT_VERSION = 5.0;
\t\t\t\tTARGETED_DEVICE_FAMILY = "1,2";
\t\t\t};
\t\t\tname = Debug;
\t\t};
\t\t${ids.extRelease} /* Release */ = {
\t\t\tisa = XCBuildConfiguration;
\t\t\tbuildSettings = {
\t\t\t\tCODE_SIGN_ENTITLEMENTS = ../PopupHubWidget/PopupHubWidget.entitlements;
\t\t\t\tCODE_SIGN_IDENTITY = "Apple Distribution";
\t\t\t\t"CODE_SIGN_IDENTITY[sdk=iphoneos*]" = "Apple Distribution";
\t\t\t\tCODE_SIGN_STYLE = Manual;
\t\t\t\tCURRENT_PROJECT_VERSION = 11;
\t\t\t\tDEVELOPMENT_TEAM = 6ACBDTX7T7;
\t\t\t\tINFOPLIST_FILE = ../PopupHubWidget/Info.plist;
\t\t\t\tIPHONEOS_DEPLOYMENT_TARGET = 17.0;
\t\t\t\tLD_RUNPATH_SEARCH_PATHS = "$(inherited) @executable_path/Frameworks @executable_path/../../Frameworks";
\t\t\t\tMARKETING_VERSION = 1.120.0;
\t\t\t\tPRODUCT_BUNDLE_IDENTIFIER = ca.popuphub.app.PopupHubWidget;
\t\t\t\tPRODUCT_NAME = "$(TARGET_NAME)";
\t\t\t\tPROVISIONING_PROFILE_SPECIFIER = "PopupHub Widget App Store";
\t\t\t\tSKIP_INSTALL = YES;
\t\t\t\tSWIFT_VERSION = 5.0;
\t\t\t\tTARGETED_DEVICE_FAMILY = "1,2";
\t\t\t};
\t\t\tname = Release;
\t\t};
/* End XCBuildConfiguration section */`
)

pbx = pbx.replace(
  '/* End XCConfigurationList section */',
  `\t\t${ids.extConfigList} /* Build configuration list for PBXNativeTarget "PopupHubWidgetExtension" */ = {
\t\t\tisa = XCConfigurationList;
\t\t\tbuildConfigurations = (
\t\t\t\t${ids.extDebug} /* Debug */,
\t\t\t\t${ids.extRelease} /* Release */,
\t\t\t);
\t\t\tdefaultConfigurationIsVisible = 0;
\t\t\tdefaultConfigurationName = Release;
\t\t};
/* End XCConfigurationList section */`
)

fs.writeFileSync(pbxPath, pbx)
console.log('Patched', pbxPath)
