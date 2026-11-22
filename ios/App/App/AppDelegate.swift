import UIKit
import Capacitor

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        // Override point for customization after application launch.
        return true
    }

    func applicationWillResignActive(_ application: UIApplication) {
        // Sent when the application is about to move from active to inactive state. This can occur for certain types of temporary interruptions (such as an incoming phone call or SMS message) or when the user quits the application and it begins the transition to the background state.
        // Use this method to pause ongoing tasks, disable timers, and invalidate graphics rendering callbacks. Games should use this method to pause the game.
    }

    func applicationDidEnterBackground(_ application: UIApplication) {
        // Use this method to release shared resources, save user data, invalidate timers, and store enough application state information to restore your application to its current state in case it is terminated later.
        // If your application supports background execution, this method is called instead of applicationWillTerminate: when the user quits.
    }

    func applicationWillEnterForeground(_ application: UIApplication) {
        // Called as part of the transition from the background to the active state; here you can undo many of the changes made on entering the background.
    }

    func applicationDidBecomeActive(_ application: UIApplication) {
        // Restart any tasks that were paused (or not yet started) while the application was inactive. If the application was previously in the background, optionally refresh the user interface.
    }

    func applicationWillTerminate(_ application: UIApplication) {
        // Called when the application is about to terminate. Save data if appropriate. See also applicationDidEnterBackground:.
    }

    // Hand the APNs registration result to @capacitor/push-notifications. Without these two the
    // WebView's 'registration' event never fires and the staff toggle times out.
    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        NotificationCenter.default.post(name: .capacitorDidRegisterForRemoteNotifications, object: deviceToken)
    }

    func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
        NotificationCenter.default.post(name: .capacitorDidFailToRegisterForRemoteNotifications, object: error)
    }

    func application(_ application: UIApplication,
                     configurationForConnecting connectingSceneSession: UISceneSession,
                     options: UIScene.ConnectionOptions) -> UISceneConfiguration {
        let config = UISceneConfiguration(name: "Default Configuration",
                                          sessionRole: connectingSceneSession.role)
        config.delegateClass = SceneDelegate.self
        return config
    }
}

/// The app's bridge view controller (SceneDelegate creates it instead of Capacitor's own).
///
/// The WebView fills the screen and keeps the page below the status bar (`contentInset: "always"`),
/// but a scrolled page still slides up behind the clock and the Dynamic Island, because the site
/// does not pad for them. A fixed strip in the page colour over the status bar area covers that,
/// so the clock always sits on a calm background. It is a subview of the WebView itself, not of its
/// scroll view, so it never moves.
class AppViewController: CAPBridgeViewController {
    private let statusBarCover = UIView()

    override func capacitorDidLoad() {
        super.capacitorDidLoad()
        statusBarCover.backgroundColor = UIColor(red: 0xf3 / 255, green: 0xf8 / 255, blue: 0xfb / 255, alpha: 1)
        statusBarCover.isUserInteractionEnabled = false
        webView?.addSubview(statusBarCover)
    }

    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        layoutStatusBarCover()
    }

    override func viewSafeAreaInsetsDidChange() {
        super.viewSafeAreaInsetsDidChange()
        layoutStatusBarCover()
    }

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        layoutStatusBarCover()
    }

    private func layoutStatusBarCover() {
        // The window's inset as well: the WebView can report none while it adjusts its own content.
        let top = max(view.safeAreaInsets.top, view.window?.safeAreaInsets.top ?? 0)
        statusBarCover.frame = CGRect(x: 0, y: 0, width: view.bounds.width, height: top)
        webView?.bringSubviewToFront(statusBarCover)
    }
}
