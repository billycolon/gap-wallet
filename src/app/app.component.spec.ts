import { TestBed } from '@angular/core/testing'
import { AppVersion } from '@ionic-native/app-version/ngx'
import { Deeplinks } from '@ionic-native/deeplinks/ngx'
import { SplashScreen } from '@ionic-native/splash-screen/ngx'
import { StatusBar } from '@ionic-native/status-bar/ngx'

import { UnitHelper } from '../../test-config/unit-test-helper'

import { AppComponent } from './app.component'

describe('AppComponent', () => {
  let unitHelper: UnitHelper
  beforeEach(() => {
    unitHelper = new UnitHelper()

    TestBed.configureTestingModule(
      unitHelper.testBed({
        providers: [
          { provide: StatusBar, useValue: unitHelper.mockRefs.statusBar },
          { provide: SplashScreen, useValue: unitHelper.mockRefs.splashScreen },
          Deeplinks,
          { provide: AppVersion, useValue: unitHelper.mockRefs.appVersion }
        ],
        declarations: [AppComponent]
      })
    )
      .compileComponents()
      .catch(console.error)
  })

  it('should create the app', () => {
    const fixture = TestBed.createComponent(AppComponent)
    const app = fixture.debugElement.componentInstance
    expect(app).toBeTruthy()
  })

  /*
  // TODO: Enable when all native parts are mocked and we can run it as "cordova"
  it('should initialize the app', async () => {
    TestBed.createComponent(AppComponent)
    expect(unitHelper.mockRefs.platform.ready).toHaveBeenCalled()
    expect(unitHelper.mockRefs.statusBar.styleDefault).toHaveBeenCalled()
    expect(unitHelper.mockRefs.splashScreen.hide).toHaveBeenCalled()
  })

  it('should initialize the app', async () => {
    TestBed.createComponent(AppComponent)
    expect(unitHelper.mockRefs.appVersion.getAppName).toHaveBeenCalled()
    expect(unitHelper.mockRefs.appVersion.getPackageName).toHaveBeenCalled()
    expect(unitHelper.mockRefs.appVersion.getVersionCode).toHaveBeenCalled()
    expect(unitHelper.mockRefs.appVersion.getVersionNumber).toHaveBeenCalled()
  })
  */

  // TODO: add more tests!
})
